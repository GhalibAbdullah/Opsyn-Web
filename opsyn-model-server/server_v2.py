"""
OPSYN Model Server v2

FastAPI server for the fine-tuned Qwen2.5-Coder-7B model.
Uses postprocessor_v2.py for robust post-processing.

Usage:
    python server_v2.py
    
Or with uvicorn:
    uvicorn server_v2:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import json
import time
import logging
import re
from pathlib import Path
from typing import Optional, Dict, Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Import post-processor from postprocessor_v2.py
from postprocessor_v2 import postprocess, load_piece_registry

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Model paths - UPDATE TO NEW MODEL
NEW_MODEL_NAME = "qwen25_coder_7b_opsyn_lora_quality"
DEFAULT_MODEL_PATH = Path(__file__).parent / NEW_MODEL_NAME

MODEL_PATH_ENV = os.environ.get("OPSYN_MODEL_PATH", None)
if MODEL_PATH_ENV:
    MODEL_PATH = str(Path(MODEL_PATH_ENV).resolve())
elif DEFAULT_MODEL_PATH.exists():
    MODEL_PATH = str(DEFAULT_MODEL_PATH.resolve())
else:
    # Fallback for Modal deployment
    MODEL_PATH = f"/cache/models/{NEW_MODEL_NAME}"

BASE_MODEL = os.environ.get("OPSYN_BASE_MODEL", "Qwen/Qwen2.5-Coder-7B-Instruct")
DEVICE = os.environ.get("OPSYN_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MAX_NEW_TOKENS = int(os.environ.get("OPSYN_MAX_TOKENS", "2048"))
PORT = int(os.environ.get("PORT", "8000"))

# System prompt for the model
SYSTEM_PROMPT = """You are an AI Workflow Builder for OPSYN (Activepieces-based). 
Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.

The workflow JSON must follow this structure:
{
  "displayName": "Workflow Name",
  "schemaVersion": "1",
  "trigger": {
    "name": "trigger",
    "type": "PIECE_TRIGGER",
    "valid": true,
    "displayName": "Trigger Display Name",
    "settings": {
      "pieceName": "@activepieces/piece-xxx",
      "pieceVersion": "~0.x.x",
      "triggerName": "trigger_name",
      "input": {}
    },
    "nextAction": {
      "name": "step_1",
      "type": "PIECE",
      "valid": true,
      "displayName": "Action Display Name",
      "settings": {
        "pieceName": "@activepieces/piece-xxx",
        "pieceVersion": "~0.x.x",
        "actionName": "action_name",
        "input": {}
      }
    }
  }
}
"""

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(
    title="OPSYN Model Server v2",
    description="AI workflow generation for Activepieces with robust post-processing",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state
model = None
tokenizer = None
model_loaded = False


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateRequest(BaseModel):
    """Request body for raw generation"""
    system_prompt: str = Field(default=SYSTEM_PROMPT, description="System prompt")
    user_prompt: str = Field(..., description="User's natural language prompt")
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=50, ge=1, le=100)


class GenerateWorkflowRequest(BaseModel):
    """Request body for complete workflow generation"""
    prompt: str = Field(..., description="User's natural language prompt")
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class GenerateResponse(BaseModel):
    """Response for raw generation"""
    output: str
    tokens_generated: int
    generation_time_ms: float
    model: str


class GenerateWorkflowResponse(BaseModel):
    """Response for complete workflow generation"""
    success: bool
    template: Optional[Dict[str, Any]] = None
    template_json: Optional[str] = None
    error: Optional[str] = None
    generation_time_ms: float
    post_processing_time_ms: float
    model: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    device: str
    model_path: str


# =============================================================================
# JSON EXTRACTION AND REPAIR (from raw model output)
# =============================================================================

def repair_json(content: str) -> str:
    """Attempt to repair common JSON syntax errors."""
    # Remove trailing commas before } or ]
    content = re.sub(r',\s*}', '}', content)
    content = re.sub(r',\s*]', ']', content)
    
    # Fix single quotes to double quotes (careful with apostrophes in text)
    # Only replace single quotes that look like JSON delimiters
    content = re.sub(r"'(\w+)':", r'"\1":', content)  # 'key': → "key":
    content = re.sub(r":\s*'([^']*)'", r': "\1"', content)  # : 'value' → : "value"
    
    # Fix unquoted property names (common model error)
    content = re.sub(r'{\s*(\w+):', r'{"\1":', content)
    content = re.sub(r',\s*(\w+):', r',"\1":', content)
    
    # Fix JavaScript-style comments (// and /* */)
    content = re.sub(r'//[^\n]*\n', '\n', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Fix missing commas between properties
    content = re.sub(r'"\s*\n\s*"', '",\n"', content)
    content = re.sub(r'}\s*\n\s*"', '},\n"', content)
    content = re.sub(r']\s*\n\s*"', '],\n"', content)
    
    # Fix true/false/null with quotes
    content = re.sub(r':\s*"true"', ': true', content)
    content = re.sub(r':\s*"false"', ': false', content)
    content = re.sub(r':\s*"null"', ': null', content)
    
    return content


def extract_json_from_output(content: str) -> str:
    """Extract JSON from model output, handling markdown and extra text."""
    if not content:
        raise ValueError("Empty content")
    
    content = content.strip()
    
    # Remove markdown code blocks
    if "```json" in content:
        match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            content = match.group(1).strip()
    elif "```" in content:
        match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            content = match.group(1).strip()
    
    # Find first {
    start_idx = content.find("{")
    if start_idx == -1:
        raise ValueError("No JSON object found")
    
    content = content[start_idx:]
    
    # Find balanced braces
    brace_count = 0
    bracket_count = 0
    end_idx = -1
    in_string = False
    i = 0
    
    while i < len(content):
        char = content[i]
        
        if in_string and char == '\\':
            i += 2
            continue
        
        if char == '"':
            in_string = not in_string
        elif not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
        i += 1
    
    if end_idx == -1:
        # Truncated - try to repair by adding closing braces/brackets
        if bracket_count > 0:
            content = content + ']' * bracket_count
        if brace_count > 0:
            content = content + '}' * brace_count
    else:
        content = content[:end_idx + 1]
    
    # Try to parse, if fails try to repair
    try:
        json.loads(content)
        return content
    except json.JSONDecodeError:
        # Try to repair common issues
        repaired = repair_json(content)
        try:
            json.loads(repaired)
            logger.info("JSON repaired successfully")
            return repaired
        except json.JSONDecodeError as e:
            # Last resort: try to fix specific character issues
            # Remove any control characters
            repaired = re.sub(r'[\x00-\x1f\x7f-\x9f]', ' ', repaired)
            repaired = repair_json(repaired)
            json.loads(repaired)  # Will raise if still invalid
            return repaired


# =============================================================================
# MODEL LOADING
# =============================================================================

def load_model():
    """Load the fine-tuned model"""
    global model, tokenizer, model_loaded, DEVICE
    
    if model_loaded:
        logger.info("Model already loaded")
        return
    
    logger.info(f"Loading base model: {BASE_MODEL}")
    logger.info(f"Loading LoRA adapter from: {MODEL_PATH}")
    logger.info(f"Using device: {DEVICE}")
    
    # Load tokenizer
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
        logger.info("Loaded tokenizer from LoRA adapter")
    except Exception:
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
        logger.info("Loaded tokenizer from base model")
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    
    # Load base model
    logger.info("Loading base model...")
    if DEVICE == "cuda":
        from transformers import BitsAndBytesConfig
        
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )
        
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            quantization_config=quantization_config,
            device_map="auto",
            trust_remote_code=True,
            token=hf_token,
        )
    else:
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            torch_dtype=torch.float16,
            device_map={"": DEVICE},
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            token=hf_token,
        )
    
    logger.info("Loading LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, MODEL_PATH)
    model.eval()
    
    model_loaded = True
    logger.info("Model loaded successfully!")


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    skip_load = os.environ.get("OPSYN_SKIP_MODEL_LOAD", "false").lower() == "true"
    if skip_load:
        logger.info("OPSYN_SKIP_MODEL_LOAD=true - Model will be lazy loaded")
        return
    
    # Load piece registry
    try:
        load_piece_registry()
        logger.info("Piece registry loaded")
    except Exception as e:
        logger.warning(f"Failed to load piece registry: {e}")
    
    # Load model
    try:
        load_model()
    except Exception as e:
        logger.error(f"Failed to load model: {e}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check"""
    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        device=DEVICE,
        model_path=MODEL_PATH,
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Generate raw output from prompt"""
    global model, tokenizer
    
    if not model_loaded:
        try:
            load_model()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Model not loaded: {e}")
    
    start_time = time.time()
    
    messages = [
        {"role": "system", "content": request.system_prompt},
        {"role": "user", "content": request.user_prompt},
    ]
    
    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt_text, return_tensors="pt", padding=True, truncation=True, max_length=4096)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    
    input_length = inputs["input_ids"].shape[1]
    generated_tokens = outputs[0][input_length:]
    output_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)
    
    generation_time = (time.time() - start_time) * 1000
    
    return GenerateResponse(
        output=output_text,
        tokens_generated=len(generated_tokens),
        generation_time_ms=generation_time,
        model=f"{BASE_MODEL} + LoRA ({NEW_MODEL_NAME})",
    )


@app.post("/generate-workflow", response_model=GenerateWorkflowResponse)
async def generate_workflow(request: GenerateWorkflowRequest):
    """Generate complete workflow with post-processing"""
    global model, tokenizer
    
    if not model_loaded:
        try:
            load_model()
        except Exception as e:
            return GenerateWorkflowResponse(
                success=False,
                error=f"Model not loaded: {e}",
                generation_time_ms=0,
                post_processing_time_ms=0,
                model=BASE_MODEL,
            )
    
    # Generate
    gen_start = time.time()
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": request.prompt},
    ]
    
    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt_text, return_tensors="pt", padding=True, truncation=True, max_length=4096)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=0.9,
            top_k=50,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    
    input_length = inputs["input_ids"].shape[1]
    generated_tokens = outputs[0][input_length:]
    raw_output = tokenizer.decode(generated_tokens, skip_special_tokens=True)
    
    generation_time = (time.time() - gen_start) * 1000
    logger.info(f"Generated {len(generated_tokens)} tokens in {generation_time:.0f}ms")
    
    # Post-process using postprocessor_v2.py
    pp_start = time.time()
    
    try:
        # Extract JSON from raw output
        json_str = extract_json_from_output(raw_output)
        
        # Post-process using postprocessor_v2
        template = postprocess(json_str)
        template_json = json.dumps(template, indent=2, ensure_ascii=False)
        
        post_processing_time = (time.time() - pp_start) * 1000
        logger.info(f"Post-processing completed in {post_processing_time:.0f}ms")
        
        return GenerateWorkflowResponse(
            success=True,
            template=template,
            template_json=template_json,
            generation_time_ms=generation_time,
            post_processing_time_ms=post_processing_time,
            model=f"{BASE_MODEL} + LoRA ({NEW_MODEL_NAME})",
        )
    
    except Exception as e:
        post_processing_time = (time.time() - pp_start) * 1000
        logger.error(f"Post-processing failed: {e}")
        
        return GenerateWorkflowResponse(
            success=False,
            error=f"Post-processing failed: {str(e)}",
            generation_time_ms=generation_time,
            post_processing_time_ms=post_processing_time,
            model=f"{BASE_MODEL} + LoRA ({NEW_MODEL_NAME})",
        )


@app.post("/process")
async def process_raw_output(raw_output: str):
    """Post-process raw model output (for external generation)"""
    try:
        start_time = time.time()
        json_str = extract_json_from_output(raw_output)
        template = postprocess(json_str)
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "template": template,
            "template_json": json.dumps(template, indent=2, ensure_ascii=False),
            "processing_time_ms": processing_time,
        }
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting OPSYN Model Server v2 on port {PORT}")
    logger.info(f"Model: {NEW_MODEL_NAME}")
    logger.info(f"Device: {DEVICE}")
    
    uvicorn.run(app, host="0.0.0.0", port=PORT)

