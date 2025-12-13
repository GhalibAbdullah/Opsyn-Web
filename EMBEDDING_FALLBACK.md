# Embedding Fallback for Name Matching

## Overview

The robust post-processor now includes an **embedding-based semantic fallback** for matching trigger and action names. This catches cases where surface-form pattern matching fails but the names are semantically equivalent.

## How It Works

```
Model Output: "notify_channel"
    ↓
1. Hardcoded fixes → ✅ Found: "send_channel_message"
    ↓
Done!

Model Output: "broadcast_message" (not in hardcoded)
    ↓
1. Hardcoded fixes → ❌ Not found
    ↓
2. Pattern matching (7 strategies) → ❌ Score: 0.3 (below 0.5 threshold)
    ↓
3. Embedding fallback:
   - Embed "broadcast_message" → [0.2, 0.5, ...]
   - Find most similar: "send_channel_message" → 0.78
   - Score ≥ 0.7 threshold → ✅ Match!
    ↓
Return: "send_channel_message"
```

## Files

| File | Description |
|------|-------------|
| `extract_embedding_pairs.py` | Extracts training pairs from registry and training data |
| `train_embedding_model.py` | Fine-tunes sentence-transformer model |
| `embedding_matcher.py` | `EmbeddingMatcher` class for semantic matching |
| `activepieces_embedding_model/` | Trained model (~90MB) |
| `embedding_training_pairs.json` | 3,981 training pairs |

## Training Data

- **3,116 positive pairs** (similar names)
- **865 negative pairs** (different names)

Sources:
- `piece_registry.json`: canonical names + display names
- Training data (777 examples): usage patterns
- Semantic synonyms: add≈insert, send≈notify, etc.

## Test Results

### Common Pieces
```
'notify_channel' ↔ 'send_channel_message': 0.748 ✅
'add_row' ↔ 'insert_row': 0.920 ✅
'new_email' ↔ 'gmail_new_email_received': 0.904 ✅
'receive_webhook' ↔ 'catch_webhook': 0.781 ✅
'send_channel_message' ↔ 'insert_row': 0.160 ✅ (correctly low)
```

### Less Common Pieces (17/17 tests passed, 100%)
```
HubSpot:      'new blog article' → 'new-blog-article' (0.98)
Pipedrive:    'updated deal' → 'updated_deal' (1.00)
Stripe:       'search subscriptions' → 'search_subscriptions' (1.00)
Salesforce:   'new or updated record' → 'new_or_updated_record' (0.99)
Discord:      'new member' → 'new_member' (1.00)
Notion:       'archive database item' → 'archive_database_item' (0.99)
Jira:         'update issue comment' → 'update_issue_comment' (1.00)
Airtable:     'updated record' → 'updated_record' (1.00)
Telegram:     'new telegram message' → 'new_telegram_message' (0.99)
```

**Coverage**: Works across all 30 pieces in the registry, not just common ones.

## Usage

The embedding fallback is enabled by default:

```python
from robust_post_processor import RobustFlowPostProcessor

# With embeddings (default)
processor = RobustFlowPostProcessor(use_embeddings=True)

# Without embeddings (faster, less accurate)
processor = RobustFlowPostProcessor(use_embeddings=False)
```

## Dependencies

Required for training:
```bash
pip install sentence-transformers datasets accelerate
```

At runtime, if dependencies are missing, the processor gracefully falls back to pattern matching only.

## Retraining

To retrain with new data:

```bash
# 1. Extract new training pairs
python3 extract_embedding_pairs.py

# 2. Train the model
python3 train_embedding_model.py

# 3. Test
python3 test_embedding_fallback.py
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 RobustFlowPostProcessor                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Hardcoded Fixes (fastest)                          │
│     └── TRIGGER_FIXES, ACTION_FIXES dictionaries       │
│                                                         │
│  2. Pattern Matching (7 strategies)                    │
│     └── Exact, Normalized, Prefix strip, Substring,    │
│         Token overlap, Levenshtein, Synonyms           │
│                                                         │
│  3. Embedding Fallback (semantic)                      │
│     └── EmbeddingMatcher with fine-tuned model         │
│         - Threshold: 0.7                               │
│         - Context-aware (piece name)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Performance

- Base model: `all-MiniLM-L6-v2` (~90MB)
- Training time: ~5 minutes on CPU
- Inference: ~1ms per embedding
- Caches embeddings for repeated queries

