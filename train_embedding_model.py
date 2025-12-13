#!/usr/bin/env python3
"""
Train a sentence-transformer model on Activepieces trigger/action name pairs.

Requirements:
    pip install sentence-transformers torch

Usage:
    python train_embedding_model.py
"""

import json
import os
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed."""
    try:
        from sentence_transformers import SentenceTransformer, InputExample, losses
        from torch.utils.data import DataLoader
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("\nInstall with:")
        print("  pip install sentence-transformers torch")
        return False

def load_training_pairs() -> list:
    """Load training pairs from JSON file."""
    with open('embedding_training_pairs.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['pairs']

def train_model():
    """Train the sentence-transformer model."""
    from sentence_transformers import SentenceTransformer, InputExample, losses
    from torch.utils.data import DataLoader
    
    print("Loading training pairs...")
    pairs = load_training_pairs()
    print(f"  Total pairs: {len(pairs)}")
    
    # Create training examples
    train_examples = []
    for pair in pairs:
        train_examples.append(InputExample(
            texts=[pair['text1'], pair['text2']], 
            label=float(pair['score'])
        ))
    
    print(f"  Training examples: {len(train_examples)}")
    
    # Load base model (small and fast)
    print("\nLoading base model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Create data loader
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)
    
    # Define loss function
    train_loss = losses.CosineSimilarityLoss(model)
    
    # Train
    print("\nTraining model...")
    print("  Epochs: 10")
    print("  Batch size: 16")
    print("  This may take a few minutes...\n")
    
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=10,
        warmup_steps=100,
        show_progress_bar=True,
        output_path='activepieces_embedding_model'
    )
    
    # Save the model
    model.save('activepieces_embedding_model')
    print(f"\n✅ Model saved to: activepieces_embedding_model/")
    
    # Test the model
    print("\nTesting model...")
    test_pairs = [
        ("send_channel_message", "post_message"),
        ("send_channel_message", "notify_channel"),
        ("send_channel_message", "insert_row"),  # Should be dissimilar
        ("insert_row", "add_row"),
        ("googlesheets_new_row_added", "new_row"),
        ("gmail_new_email_received", "new_email"),
        ("catch_webhook", "receive_webhook"),
    ]
    
    for text1, text2 in test_pairs:
        emb1 = model.encode(text1)
        emb2 = model.encode(text2)
        similarity = float((emb1 @ emb2) / (sum(emb1**2)**0.5 * sum(emb2**2)**0.5))
        print(f"  '{text1}' ↔ '{text2}': {similarity:.3f}")
    
    return model

def main():
    if not check_dependencies():
        return
    
    # Check if training pairs exist
    if not Path('embedding_training_pairs.json').exists():
        print("❌ Training pairs not found. Run extract_embedding_pairs.py first.")
        return
    
    train_model()
    print("\n✅ Training complete!")
    print("\nNext steps:")
    print("  1. The model is saved in 'activepieces_embedding_model/'")
    print("  2. Use EmbeddingMatcher class to integrate with robust_post_processor.py")

if __name__ == '__main__':
    main()

