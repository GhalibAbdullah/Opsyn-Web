"""
Modal deployment for OPSYN Model Server v2

Deploy with:
    modal deploy modal_app_v2.py

Or test locally with Modal:
    modal serve modal_app_v2.py

Setup (one-time):
    1. modal volume create opsyn-model-cache
    2. modal volume put opsyn-model-cache ./qwen25_coder_7b_opsyn_lora_quality /models/qwen25_coder_7b_opsyn_lora_quality
    3. modal volume put opsyn-model-cache ./piece_registry.json /models/piece_registry.json
"""

import os
import modal

# =============================================================================
# MODAL IMAGE DEFINITION
# =============================================================================

NEW_MODEL_NAME = "qwen25_coder_7b_opsyn_lora_quality"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        # FastAPI server
        "fastapi==0.109.0",
        "uvicorn[standard]==0.27.0",
        "pydantic==2.5.3",
        # Model inference
        "torch>=2.1.0",
        "transformers>=4.45.0",
        "peft>=0.7.0",
        "accelerate>=0.25.0",
        "safetensors>=0.4.0",
        "bitsandbytes>=0.41.0",
        # Utilities
        "numpy>=1.24.0",
        "python-dotenv==1.0.0",
        "huggingface-hub>=0.20.0",
        # Smart matching for trigger/action names
        "rapidfuzz>=3.0.0",
        "hf_transfer",  # Fast model downloads
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "TOKENIZERS_PARALLELISM": "false",
    })
    # Copy server_v2.py and postprocessor_v2.py into the image
    .add_local_file("server_v2.py", "/app/server_v2.py")
    .add_local_file("postprocessor_v2.py", "/app/postprocessor_v2.py")
    .add_local_file("smart_matcher.py", "/app/smart_matcher.py")
    # Also copy piece_registry.json (fallback if not in volume)
    .add_local_file("piece_registry.json", "/app/piece_registry.json")
)

# =============================================================================
# MODAL VOLUME (persistent storage for models)
# =============================================================================

model_volume = modal.Volume.from_name("opsyn-model-cache", create_if_missing=True)

# =============================================================================
# MODAL APP DEFINITION
# =============================================================================

app = modal.App("opsyn-model-server-v2")


@app.function(
    image=image,
    # GPU: A10G 24GB
    gpu="A10G",
    # Mount persistent volume at /cache
    volumes={"/cache": model_volume},
    # Timeouts
    timeout=600,
    # Scale down after 20 seconds idle (aggressive cost savings)
    scaledown_window=20,
    # Memory allocation
    memory=32768,
    # Your HuggingFace secret
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.concurrent(max_inputs=1)
@modal.asgi_app()
def fastapi_app():
    """
    Mount FastAPI app for Modal deployment.
    Environment is set up before importing server_v2.py.
    """
    import sys
    from pathlib import Path
    
    # =========================================================================
    # SET ENVIRONMENT VARIABLES BEFORE IMPORTING SERVER
    # =========================================================================
    
    # HuggingFace cache directories (in persistent volume)
    os.environ["HF_HOME"] = "/cache/huggingface"
    os.environ["TRANSFORMERS_CACHE"] = "/cache/huggingface/hub"
    os.environ["HF_HUB_CACHE"] = "/cache/huggingface/hub"
    
    # Read HuggingFace token from secret
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    if hf_token:
        os.environ["HF_TOKEN"] = hf_token
        os.environ["HUGGINGFACE_HUB_TOKEN"] = hf_token
        print("✅ HuggingFace token loaded from secret")
    else:
        print("⚠️  No HuggingFace token found in secret")
    
    # Device = CUDA (we're on GPU)
    os.environ["OPSYN_DEVICE"] = "cuda"
    
    # =========================================================================
    # MODEL PATH CONFIGURATION - NEW MODEL
    # =========================================================================
    
    # Check for LoRA adapter in volume (new model name)
    volume_model_path = Path(f"/cache/models/{NEW_MODEL_NAME}")
    
    if volume_model_path.exists() and (volume_model_path / "adapter_config.json").exists():
        os.environ["OPSYN_MODEL_PATH"] = str(volume_model_path)
        print(f"✅ LoRA adapter found in volume: {volume_model_path}")
    else:
        print(f"⚠️  LoRA adapter NOT found at {volume_model_path}")
        print("   Running with BASE MODEL ONLY (no fine-tuning)")
    
    # =========================================================================
    # PIECE REGISTRY
    # =========================================================================
    
    # Check for piece_registry.json in volume first, then fall back to image copy
    volume_registry = Path("/cache/models/piece_registry.json")
    app_registry = Path("/app/piece_registry.json")
    
    if volume_registry.exists():
        # Create symlink where postprocessor_v2.py can find it
        target = Path("/app/piece_registry.json")
        if not target.exists():
            try:
                target.symlink_to(volume_registry)
                print("✅ piece_registry.json linked from volume")
            except Exception as e:
                print(f"⚠️  Could not symlink registry: {e}")
    elif app_registry.exists():
        print("✅ piece_registry.json found in image")
    else:
        print("⚠️  piece_registry.json not found")
    
    # =========================================================================
    # ADD SERVER DIRECTORY TO PATH AND IMPORT
    # =========================================================================
    
    # server_v2.py is at /app/server_v2.py
    server_dir = Path("/app")
    sys.path.insert(0, str(server_dir))
    
    print(f"📁 Server directory: {server_dir}")
    print(f"📄 server_v2.py exists: {(server_dir / 'server_v2.py').exists()}")
    print(f"📄 postprocessor_v2.py exists: {(server_dir / 'postprocessor_v2.py').exists()}")
    print(f"📄 piece_registry.json exists: {(server_dir / 'piece_registry.json').exists()}")
    print(f"🔧 Device: {os.environ.get('OPSYN_DEVICE', 'unknown')}")
    print(f"📦 Model path: {os.environ.get('OPSYN_MODEL_PATH', '(default)')}")
    print(f"💾 HF cache: {os.environ.get('HF_HOME', 'unknown')}")
    
    # List /app contents for debugging
    if server_dir.exists():
        print(f"📂 /app contents: {list(server_dir.iterdir())}")
    
    # Import FastAPI app from server_v2.py
    try:
        from server_v2 import app as fastapi_server
        print("✅ Successfully imported FastAPI app from server_v2.py")
    except Exception as e:
        print(f"❌ Failed to import server_v2.py: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    return fastapi_server


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

@app.function(
    image=image,
    volumes={"/cache": model_volume},
    timeout=60,
)
def check_model_files():
    """Check if all required model files are present in volume."""
    from pathlib import Path
    
    print("=== Checking Model Files ===\n")
    
    # Check LoRA adapter (new model)
    lora_path = Path(f"/cache/models/{NEW_MODEL_NAME}")
    print(f"LoRA adapter: {lora_path}")
    print(f"  - exists: {lora_path.exists()}")
    if lora_path.exists():
        print(f"  - adapter_config.json: {(lora_path / 'adapter_config.json').exists()}")
        print(f"  - adapter_model.safetensors: {(lora_path / 'adapter_model.safetensors').exists()}")
        files = list(lora_path.iterdir())
        print(f"  - total files: {len(files)}")
        for f in files:
            print(f"    - {f.name}")
    
    # Check piece registry
    registry_path = Path("/cache/models/piece_registry.json")
    print(f"\nPiece registry (volume): {registry_path}")
    print(f"  - exists: {registry_path.exists()}")
    
    app_registry = Path("/app/piece_registry.json")
    print(f"Piece registry (image): {app_registry}")
    print(f"  - exists: {app_registry.exists()}")
    
    # Check HuggingFace cache
    hf_cache = Path("/cache/huggingface/hub")
    print(f"\nHuggingFace cache: {hf_cache}")
    print(f"  - exists: {hf_cache.exists()}")
    if hf_cache.exists():
        model_dirs = [d for d in hf_cache.iterdir() if d.is_dir() and d.name.startswith("models--")]
        print(f"  - cached models: {len(model_dirs)}")
        for d in model_dirs:
            print(f"    - {d.name}")
    
    # Check /app
    app_dir = Path("/app")
    print(f"\n/app directory: {app_dir}")
    print(f"  - exists: {app_dir.exists()}")
    if app_dir.exists():
        print(f"  - contents: {list(app_dir.iterdir())}")


@app.function(
    image=image,
    volumes={"/cache": model_volume},
    timeout=300,
)
def upload_model_to_volume():
    """
    Helper to upload model files from local directory.
    Note: For large models, use modal volume put directly from CLI.
    """
    from pathlib import Path
    import shutil
    
    print("=== Volume Paths ===")
    print("To upload your model, run these commands from your local machine:\n")
    print(f"# Upload the new LoRA model")
    print(f"modal volume put opsyn-model-cache ./qwen25_coder_7b_opsyn_lora_quality /models/{NEW_MODEL_NAME}")
    print("")
    print("# Upload piece_registry.json")
    print("modal volume put opsyn-model-cache ./piece_registry.json /models/piece_registry.json")
    print("")
    print("# Check what's in the volume")
    print("modal volume ls opsyn-model-cache /models")


@app.local_entrypoint()
def main():
    """Local entrypoint for testing."""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "upload":
        print("Upload instructions:")
        upload_model_to_volume.remote()
    else:
        print("Checking volume contents...")
        check_model_files.remote()

