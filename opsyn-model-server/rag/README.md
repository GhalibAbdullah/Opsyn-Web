# RAG System for Activepieces Workflow Generation

This RAG (Retrieval-Augmented Generation) system generates valid Activepieces workflows from natural language descriptions.

## How It Works

```
┌─────────────────┐
│  User Prompt    │
│ "Gmail → Slack" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Semantic Search        │
│  Find relevant pieces   │
│  (Gmail, Slack)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Inject Context         │
│  Real action names:     │
│  - gmail_new_email      │
│  - send_channel_message │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Gemini/OpenAI          │
│  Generate workflow      │
│  with correct names     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Post-process           │
│  Add missing fields     │
│  Validate structure     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  FlowTemplate           │
│  Ready for import!      │
└─────────────────────────┘
```

## Setup

### 1. Create virtual environment and install dependencies

```bash
cd opsyn-model-server

# Option 1: Use setup script
chmod +x setup_venv.sh
./setup_venv.sh

# Option 2: Manual setup
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r rag/requirements.txt
```

**Important:** Always activate the virtual environment before running RAG commands:
```bash
source venv/bin/activate
```

### 2. Build knowledge base (one-time or when pieces change)

```bash
cd opsyn-model-server
source venv/bin/activate  # Activate virtual environment
python -m rag.build_knowledge_base
```

This will:
- Scan `packages/pieces` directory
- Extract all pieces, actions, triggers
- Generate embeddings for semantic search
- Save to `rag/pieces_knowledge_base.json` and `rag/pieces_embeddings.json`

### 3. Set API key

Create a `.env` file in `opsyn-model-server/`:

```bash
# Copy template
cp rag/env_template.txt ../.env

# Edit with your API key
nano ../.env
```

Or add to `.env`:
```
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here  # optional
```

Get Gemini API key (free): https://aistudio.google.com/app/apikey

## Usage

### Python API

```python
from rag.workflow_generator import WorkflowGenerator

# Initialize
generator = WorkflowGenerator()

# Generate workflow
result = generator.generate("When a new email arrives, send to Slack")

# result is a FlowTemplate dict ready for import
print(result["template"]["trigger"]["settings"]["triggerName"])
# Output: gmail_new_email_received
```

### Command Line

```bash
source venv/bin/activate  # Activate virtual environment first
python -m rag.workflow_generator
```

## Files

| File | Description |
|------|-------------|
| `piece_extractor.py` | Parses TypeScript to extract pieces |
| `embedding_generator.py` | Creates vector embeddings |
| `retriever.py` | Semantic search for relevant pieces |
| `llm_client.py` | Gemini/OpenAI integration |
| `workflow_generator.py` | Main pipeline |
| `build_knowledge_base.py` | One-command build script |

## Generated Files

| File | Description |
|------|-------------|
| `pieces_knowledge_base.json` | All pieces, actions, triggers |
| `pieces_embeddings.json` | Metadata for embeddings |
| `pieces_embeddings_vectors.npy` | Numpy array of embeddings |

## Key Benefits

1. **Always uses real action names** - Retrieved from actual codebase
2. **Self-updating** - Rebuild when pieces change
3. **No training needed** - Works immediately
4. **Free tier available** - Gemini has generous free quota
5. **Fast** - Embeddings are pre-computed at build time

## Configuration

### LLM Provider

```python
# Use Gemini (default, free)
generator = WorkflowGenerator(llm_provider="gemini")

# Use OpenAI
generator = WorkflowGenerator(llm_provider="openai", llm_model="gpt-4o")

# Auto-detect (tries Gemini first)
generator = WorkflowGenerator(llm_provider="auto")
```

### Custom Paths

```python
generator = WorkflowGenerator(
    kb_path="/path/to/pieces_knowledge_base.json",
    embeddings_path="/path/to/pieces_embeddings.json"
)
```

