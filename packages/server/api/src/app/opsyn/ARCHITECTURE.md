# OPSYN Architecture

## Two Modes of Operation

### Mode 1: Python Model Server (Primary - RECOMMENDED)

**Flow:** User Prompt → TypeScript API → Python Server → FlowTemplate

```
┌─────────────────────────────────────────────────────────────────┐
│ TypeScript Backend (Activepieces)                               │
│                                                                  │
│  opsyn.controller.ts                                            │
│         ↓                                                        │
│  opsyn.service.generateFromPrompt()                             │
│         ↓                                                        │
│  model-inference.service.generateWorkflow()                     │
│         ↓ HTTP POST /generate-workflow                          │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ Python Model Server (opsyn-model-server/server.py)             │
│                                                                  │
│  1. Model Inference (Qwen2.5-Coder-7B + LoRA)                  │
│  2. JSON Extraction & Validation                                │
│  3. RobustFlowPostProcessor (Python)                            │
│     - Fix versions                                              │
│     - Pattern matching (NameMatcher)                            │
│     - Embedding matching (sentence-transformers)                │
│     - Field name conversions                                    │
│  4. FlowTemplate Conversion                                     │
│                                                                  │
│  Returns: Complete FlowTemplate JSON ✅                         │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration:**
- `OPSYN_MODEL_URL` - Python server URL (default: `http://localhost:8000`)
- Python server handles ALL post-processing including embeddings
- No TypeScript dependencies on `@xenova/transformers` needed

**Advantages:**
- ✅ Model runs on GPU
- ✅ Faster inference
- ✅ All post-processing in one place
- ✅ Embeddings handled by Python (sentence-transformers)
- ✅ No complex TypeScript dependencies

---

### Mode 2: TypeScript-Only Processing (Fallback)

**Flow:** Raw Model Output → TypeScript Post-Processor → FlowTemplate

```
┌─────────────────────────────────────────────────────────────────┐
│ TypeScript Backend (Activepieces)                               │
│                                                                  │
│  opsyn.service.processRawOutput()                               │
│         ↓                                                        │
│  opsyn-pipeline.processModelOutputToFlowTemplate()              │
│         ↓                                                        │
│  RobustFlowPostProcessor (TypeScript)                           │
│     - Fix versions                                              │
│     - Pattern matching (NameMatcher)                            │
│     - Embedding matching (EmbeddingMatcher) [OPTIONAL]          │
│       Uses @xenova/transformers (lazy loaded)                   │
│     - Field name conversions                                    │
│         ↓                                                        │
│  FlowTemplate Conversion                                        │
│                                                                  │
│  Returns: FlowTemplate JSON                                     │
└─────────────────────────────────────────────────────────────────┘
```

**When to use:**
- Processing raw model output from external sources
- Testing post-processing logic without Python server
- Fallback if Python server is unavailable

**Configuration:**
- `useEmbeddings` parameter (default: `false`)
- If enabled, requires `@xenova/transformers` (dynamically imported)
- Embedding model path: `activepieces_embedding_model/`

---

## Current Setup

**Primary Mode:** Python Model Server ✅

The TypeScript backend calls the Python server which handles everything:
1. Model inference
2. Post-processing (including embeddings)
3. FlowTemplate conversion

**Dependencies:**
- Python server: `sentence-transformers`, `torch`, `transformers`, `peft`
- TypeScript: No embedding dependencies needed (embeddings disabled by default)

**Why `@xenova/transformers` is in package.json:**
- Legacy/fallback support for Mode 2
- Marked as external in build config
- Dynamically imported (lazy loaded) only if embeddings explicitly enabled
- **Not used in primary flow**

---

## Deployment

### Development
```bash
# Terminal 1: Start Python model server
cd opsyn-model-server
python server.py

# Terminal 2: Start Activepieces
npm run dev
```

### Production
```bash
# Set environment variable
export OPSYN_MODEL_URL=http://your-model-server:8000

# Or deploy Python server to Modal/cloud
cd opsyn-model-server
modal deploy modal_app.py
export OPSYN_MODEL_URL=https://your-modal-url.modal.run
```

---

## Summary

**Current Architecture:** TypeScript API → Python Model Server → Complete FlowTemplate

- ✅ Python handles ALL processing (model + post-processing + embeddings)
- ✅ TypeScript just forwards requests and receives results
- ✅ No `@xenova/transformers` loaded in TypeScript runtime
- ✅ Clean separation of concerns

