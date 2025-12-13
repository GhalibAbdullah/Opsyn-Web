# Integration Options for Models

## Current State

**Activepieces Architecture:**
- **Language**: TypeScript/Node.js (no Python dependencies)
- **AI Models**: Use `@ai-sdk/*` packages → call external APIs (OpenAI, Anthropic, etc.)
- **Python Scripts**: Currently standalone utilities (not integrated)

**Your Models:**
- **Qwen Coder 7B**: Python-based (likely uses transformers, vLLM, or similar)
- **Embedding Model**: Python-based (sentence-transformers)

## Integration Options

### Option 1: Port Embeddings to TypeScript (Recommended for Embeddings)

**Use `@xenova/transformers`** - Pure JavaScript, no Python needed.

```typescript
// packages/server/api/src/app/flow-post-processor/embedding-matcher.ts
import { pipeline } from '@xenova/transformers';

class EmbeddingMatcher {
  private model: any;
  
  async init() {
    this.model = await pipeline('feature-extraction', 
      'Xenova/all-MiniLM-L6-v2'); // or your fine-tuned model
  }
  
  async findMatch(query: string, candidates: string[]): Promise<string | null> {
    const queryEmbedding = await this.model(query);
    // ... similarity search
  }
}
```

**Pros:**
- ✅ No Python dependencies
- ✅ Works with `npm run dev` out of the box
- ✅ Same ecosystem as Activepieces
- ✅ Can bundle model with the app

**Cons:**
- ⚠️ Need to retrain/convert model to ONNX format
- ⚠️ Slightly larger bundle size (~90MB model)

**Dependencies to add:**
```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0"
  }
}
```

---

### Option 2: Call Python via Subprocess (For Qwen Model)

**Keep Python scripts, call from Node.js.**

```typescript
// packages/server/api/src/app/flow-post-processor/post-processor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function postProcessFlow(flowJson: string): Promise<string> {
  const scriptPath = path.join(__dirname, '../../../../robust_post_processor.py');
  const { stdout } = await execAsync(
    `python3 ${scriptPath}`, 
    { input: flowJson }
  );
  return stdout;
}
```

**Pros:**
- ✅ Keep existing Python code
- ✅ No retraining needed
- ✅ Works with current models

**Cons:**
- ❌ **Users need Python 3.8+ installed**
- ❌ **Users need to install dependencies**: `pip install sentence-transformers torch`
- ❌ Platform-specific (Windows/Mac/Linux differences)
- ❌ Slower (spawns new process each time)

**User Requirements:**
```bash
# Users must run:
python3 --version  # Must be 3.8+
pip install sentence-transformers torch accelerate
```

---

### Option 3: Separate Microservice/API (Best for Production)

**Run models as a separate service.**

```typescript
// packages/server/api/src/app/flow-post-processor/post-processor.ts
async function postProcessFlow(flowJson: string): Promise<string> {
  const response = await fetch('http://localhost:8000/post-process', {
    method: 'POST',
    body: JSON.stringify({ flow: flowJson })
  });
  return response.json();
}
```

**Python Service (FastAPI):**
```python
# services/flow-processor/main.py
from fastapi import FastAPI
from robust_post_processor import RobustFlowPostProcessor

app = FastAPI()
processor = RobustFlowPostProcessor()

@app.post("/post-process")
async def post_process(flow: dict):
    return processor.process(flow)
```

**Pros:**
- ✅ Isolated from main app
- ✅ Can scale independently
- ✅ Language-agnostic
- ✅ Easy to deploy separately

**Cons:**
- ⚠️ More complex architecture
- ⚠️ Need to manage two services

---

### Option 4: Use External API (Like Activepieces Does for AI)

**Call an external API for post-processing.**

Similar to how Activepieces calls OpenAI/Anthropic APIs, you could:
- Deploy your models to a cloud service (HuggingFace Inference API, Replicate, etc.)
- Call via HTTP

**Pros:**
- ✅ No local dependencies
- ✅ Scales automatically
- ✅ Consistent with Activepieces pattern

**Cons:**
- ❌ Requires external service
- ❌ May have costs
- ❌ Network latency

---

## Recommendation

### For Embeddings (Post-Processor):
**Use Option 1 (TypeScript with @xenova/transformers)**
- No Python dependencies for users
- Works seamlessly with `npm run dev`
- Can bundle model with the app

### For Qwen Model (Flow Generation):
**Use Option 2 (Subprocess) or Option 3 (Microservice)**
- Qwen is large and complex
- Better to keep separate
- Option 3 is better for production

---

## Implementation Example (Option 1 - TypeScript Embeddings)

### Step 1: Install Dependencies

```bash
npm install @xenova/transformers
```

### Step 2: Convert Model to ONNX

```bash
# Convert your fine-tuned model
python3 -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('activepieces_embedding_model')
model.save('activepieces_embedding_model_onnx', format='onnx')
"
```

### Step 3: Create TypeScript Wrapper

```typescript
// packages/server/api/src/app/flow-post-processor/embedding-matcher.ts
import { pipeline, Pipeline } from '@xenova/transformers';

export class EmbeddingMatcher {
  private extractor: Pipeline | null = null;
  
  async init() {
    this.extractor = await pipeline(
      'feature-extraction',
      './activepieces_embedding_model_onnx', // or HuggingFace model ID
      { quantized: false }
    );
  }
  
  async findBestMatch(
    query: string,
    candidates: string[],
    threshold: number = 0.7
  ): Promise<[string, number] | null> {
    if (!this.extractor) await this.init();
    
    const queryEmbedding = await this.extractor(query, { pooling: 'mean', normalize: true });
    // ... find best match
  }
}
```

### Step 4: Integrate into Post-Processor

```typescript
// packages/server/api/src/app/flow-post-processor/robust-post-processor.ts
import { EmbeddingMatcher } from './embedding-matcher';

export class RobustFlowPostProcessor {
  private embeddingMatcher: EmbeddingMatcher;
  
  constructor() {
    this.embeddingMatcher = new EmbeddingMatcher();
  }
  
  async process(flow: Flow): Promise<Flow> {
    // ... existing logic
    // Use embeddingMatcher as fallback
  }
}
```

---

## User Experience Comparison

### Option 1 (TypeScript) ✅
```bash
git clone activepieces
npm install
npm run dev
# ✅ Works immediately, no extra setup
```

### Option 2 (Python Subprocess) ❌
```bash
git clone activepieces
npm install
python3 --version  # Must check
pip install sentence-transformers torch  # Must install
npm run dev
# ⚠️ May fail if Python/deps missing
```

### Option 3 (Microservice) ⚠️
```bash
git clone activepieces
npm install
cd services/flow-processor
pip install -r requirements.txt
python3 main.py  # In separate terminal
npm run dev  # In main terminal
# ⚠️ Two services to manage
```

---

## Summary

**For MVP/Development:**
- Embeddings: Port to TypeScript (`@xenova/transformers`)
- Qwen: Use subprocess (quick to implement)

**For Production:**
- Embeddings: TypeScript (bundled with app)
- Qwen: Microservice (better isolation)

**User Requirements:**
- **Option 1**: No extra dependencies ✅
- **Option 2**: Python + pip packages ❌
- **Option 3**: Two services to run ⚠️

