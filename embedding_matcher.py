#!/usr/bin/env python3
"""
EmbeddingMatcher: Semantic similarity matching for trigger/action names.

This module provides embedding-based matching as a fallback when pattern matching fails.
It uses a fine-tuned sentence-transformer model trained on Activepieces terminology.
"""

import json
import os
from pathlib import Path
from typing import List, Optional, Tuple, Dict
import numpy as np

class EmbeddingMatcher:
    """
    Semantic matcher using sentence embeddings.
    
    Falls back gracefully if the model is not available:
    - If sentence-transformers is not installed: returns None
    - If model is not trained: uses base model with reduced accuracy
    """
    
    MODEL_PATH = Path(__file__).parent / 'activepieces_embedding_model'
    BASE_MODEL = 'all-MiniLM-L6-v2'
    
    def __init__(self, threshold: float = 0.7):
        """
        Initialize the embedding matcher.
        
        Args:
            threshold: Minimum similarity score to consider a match (0-1)
        """
        self.threshold = threshold
        self.model = None
        self.available = False
        self._cache: Dict[str, np.ndarray] = {}
        
        self._load_model()
    
    def _load_model(self):
        """Load the sentence-transformer model."""
        try:
            from sentence_transformers import SentenceTransformer
            
            # Try fine-tuned model first
            if self.MODEL_PATH.exists():
                self.model = SentenceTransformer(str(self.MODEL_PATH))
                self.available = True
                print(f"  ℹ️  Loaded fine-tuned embedding model from {self.MODEL_PATH}")
            else:
                # Fall back to base model
                self.model = SentenceTransformer(self.BASE_MODEL)
                self.available = True
                print(f"  ⚠️  Fine-tuned model not found, using base model ({self.BASE_MODEL})")
                
        except ImportError:
            self.available = False
            # Silently fail - embedding matching is optional
    
    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding for a text, with caching."""
        if not self.available:
            return None
        
        if text not in self._cache:
            self._cache[text] = self.model.encode(text, convert_to_numpy=True)
        
        return self._cache[text]
    
    def _cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings."""
        return float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
    
    def find_best_match(
        self, 
        query: str, 
        candidates: List[str],
        context: Optional[str] = None
    ) -> Optional[Tuple[str, float]]:
        """
        Find the best matching candidate for a query using semantic similarity.
        
        Args:
            query: The name to match (e.g., "notify_channel")
            candidates: List of valid names to match against
            context: Optional context (e.g., piece name) to improve matching
            
        Returns:
            Tuple of (best_match, score) if found, None if no match above threshold
        """
        if not self.available or not candidates:
            return None
        
        # Add context to query if provided
        if context:
            # Extract short piece name
            short_context = context.split('/')[-1].replace('piece-', '').replace('-', ' ')
            query_with_context = f"{short_context} {query}"
        else:
            query_with_context = query
        
        # Get query embedding
        query_emb = self._get_embedding(query_with_context)
        if query_emb is None:
            return None
        
        # Calculate similarity with each candidate
        best_match = None
        best_score = 0.0
        
        for candidate in candidates:
            # Also embed candidate with context for fair comparison
            if context:
                short_context = context.split('/')[-1].replace('piece-', '').replace('-', ' ')
                candidate_with_context = f"{short_context} {candidate}"
            else:
                candidate_with_context = candidate
            
            candidate_emb = self._get_embedding(candidate_with_context)
            if candidate_emb is None:
                continue
            
            similarity = self._cosine_similarity(query_emb, candidate_emb)
            
            if similarity > best_score:
                best_score = similarity
                best_match = candidate
        
        if best_match and best_score >= self.threshold:
            return (best_match, best_score)
        
        return None
    
    def find_matches(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 3,
        context: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """
        Find top-k matching candidates for a query.
        
        Args:
            query: The name to match
            candidates: List of valid names
            top_k: Number of top matches to return
            context: Optional context for better matching
            
        Returns:
            List of (match, score) tuples, sorted by score descending
        """
        if not self.available or not candidates:
            return []
        
        # Add context
        if context:
            short_context = context.split('/')[-1].replace('piece-', '').replace('-', ' ')
            query_with_context = f"{short_context} {query}"
        else:
            query_with_context = query
        
        query_emb = self._get_embedding(query_with_context)
        if query_emb is None:
            return []
        
        # Calculate all similarities
        similarities = []
        for candidate in candidates:
            if context:
                candidate_with_context = f"{short_context} {candidate}"
            else:
                candidate_with_context = candidate
            
            candidate_emb = self._get_embedding(candidate_with_context)
            if candidate_emb is not None:
                similarity = self._cosine_similarity(query_emb, candidate_emb)
                similarities.append((candidate, similarity))
        
        # Sort by similarity and return top-k
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
    
    def is_available(self) -> bool:
        """Check if embedding matching is available."""
        return self.available


# Singleton instance for global use
_embedding_matcher: Optional[EmbeddingMatcher] = None

def get_embedding_matcher(threshold: float = 0.7) -> EmbeddingMatcher:
    """Get or create the global embedding matcher instance."""
    global _embedding_matcher
    if _embedding_matcher is None:
        _embedding_matcher = EmbeddingMatcher(threshold=threshold)
    return _embedding_matcher


def test_matcher():
    """Test the embedding matcher."""
    print("Testing EmbeddingMatcher...")
    
    matcher = EmbeddingMatcher(threshold=0.6)
    
    if not matcher.is_available():
        print("❌ Embedding matcher not available (missing dependencies)")
        return
    
    print("✅ Embedding matcher available\n")
    
    # Test cases
    test_cases = [
        {
            'query': 'notify_channel',
            'candidates': ['send_channel_message', 'send_direct_message', 'update_message', 'get_channel_history'],
            'context': '@activepieces/piece-slack',
            'expected': 'send_channel_message'
        },
        {
            'query': 'add_row',
            'candidates': ['insert_row', 'update_row', 'delete_row', 'find_rows'],
            'context': '@activepieces/piece-google-sheets',
            'expected': 'insert_row'
        },
        {
            'query': 'new_email',
            'candidates': ['gmail_new_email_received', 'send_email', 'gmail_get_mail'],
            'context': '@activepieces/piece-gmail',
            'expected': 'gmail_new_email_received'
        },
        {
            'query': 'receive_webhook',
            'candidates': ['catch_webhook'],
            'context': '@activepieces/piece-webhook',
            'expected': 'catch_webhook'
        },
        {
            'query': 'post_to_slack',
            'candidates': ['send_channel_message', 'send_direct_message', 'update_message'],
            'context': '@activepieces/piece-slack',
            'expected': 'send_channel_message'
        },
    ]
    
    passed = 0
    for tc in test_cases:
        result = matcher.find_best_match(tc['query'], tc['candidates'], tc['context'])
        if result:
            match, score = result
            status = "✅" if match == tc['expected'] else "❌"
            print(f"{status} '{tc['query']}' → '{match}' (score: {score:.3f}, expected: '{tc['expected']}')")
            if match == tc['expected']:
                passed += 1
        else:
            print(f"❌ '{tc['query']}' → No match (expected: '{tc['expected']}')")
    
    print(f"\nPassed: {passed}/{len(test_cases)}")


if __name__ == '__main__':
    test_matcher()

