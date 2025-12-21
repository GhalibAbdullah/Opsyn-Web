#!/usr/bin/env python3
"""
Embedding Generator - Creates vector embeddings for semantic search.

Uses sentence-transformers (free, local) or OpenAI embeddings.
Generates embeddings for:
- Piece descriptions
- Action names + descriptions
- Trigger names + descriptions

These embeddings enable semantic search: "send email" → finds gmail.send_email
"""

import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import hashlib


@dataclass
class EmbeddingEntry:
    """A single embedding entry."""
    id: str  # e.g., "gmail.send_email"
    text: str  # The text that was embedded
    embedding: List[float]
    metadata: Dict  # piece_name, action/trigger name, etc.


class EmbeddingGenerator:
    """Generate embeddings for piece knowledge base."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize with embedding model.
        
        Args:
            model_name: Sentence transformer model name
                - "all-MiniLM-L6-v2" (fast, good quality, 384 dims)
                - "all-mpnet-base-v2" (slower, better quality, 768 dims)
        """
        self.model_name = model_name
        self.model = None
        self.embeddings: List[EmbeddingEntry] = []
    
    def _load_model(self):
        """Lazy load the embedding model."""
        if self.model is None:
            try:
                from sentence_transformers import SentenceTransformer
                print(f"Loading embedding model: {self.model_name}")
                self.model = SentenceTransformer(self.model_name)
                print(f"Model loaded. Embedding dimension: {self.model.get_sentence_embedding_dimension()}")
            except ImportError:
                raise ImportError(
                    "sentence-transformers not installed. Run: pip install sentence-transformers"
                )
    
    def generate_from_knowledge_base(self, kb_path: str) -> List[EmbeddingEntry]:
        """
        Generate embeddings from pieces knowledge base.
        
        Args:
            kb_path: Path to pieces_knowledge_base.json
        
        Returns:
            List of embedding entries
        """
        self._load_model()
        
        with open(kb_path, 'r', encoding='utf-8') as f:
            kb = json.load(f)
        
        texts_to_embed = []
        metadata_list = []
        
        for package_name, piece in kb["pieces"].items():
            piece_name = piece["name"]
            piece_display = piece["displayName"]
            piece_desc = piece.get("description", "")
            
            # Embed piece itself
            piece_text = f"{piece_display}: {piece_desc}"
            texts_to_embed.append(piece_text)
            metadata_list.append({
                "id": f"piece:{piece_name}",
                "type": "piece",
                "package_name": package_name,
                "piece_name": piece_name,
                "displayName": piece_display,
            })
            
            # Embed each action
            for action_name, action in piece.get("actions", {}).items():
                action_display = action["displayName"]
                action_desc = action.get("description", "")
                
                # Create rich text for better semantic matching
                action_text = f"{piece_display} - {action_display}: {action_desc}"
                texts_to_embed.append(action_text)
                metadata_list.append({
                    "id": f"action:{piece_name}.{action_name}",
                    "type": "action",
                    "package_name": package_name,
                    "piece_name": piece_name,
                    "action_name": action_name,
                    "displayName": action_display,
                    "description": action_desc,
                    "props": action.get("props", []),
                })
                
                # Also embed action name variants for better matching
                variants = [
                    action_display.lower(),
                    action_name.replace("_", " "),
                    f"{piece_name} {action_display}".lower(),
                ]
                for variant in variants:
                    texts_to_embed.append(variant)
                    metadata_list.append({
                        "id": f"action_variant:{piece_name}.{action_name}",
                        "type": "action_variant",
                        "package_name": package_name,
                        "piece_name": piece_name,
                        "action_name": action_name,
                        "displayName": action_display,
                    })
            
            # Embed each trigger
            for trigger_name, trigger in piece.get("triggers", {}).items():
                trigger_display = trigger["displayName"]
                trigger_desc = trigger.get("description", "")
                
                trigger_text = f"{piece_display} - {trigger_display}: {trigger_desc}"
                texts_to_embed.append(trigger_text)
                metadata_list.append({
                    "id": f"trigger:{piece_name}.{trigger_name}",
                    "type": "trigger",
                    "package_name": package_name,
                    "piece_name": piece_name,
                    "trigger_name": trigger_name,
                    "displayName": trigger_display,
                    "description": trigger_desc,
                    "trigger_type": trigger.get("trigger_type", "POLLING"),
                    "props": trigger.get("props", []),
                })
                
                # Trigger variants
                variants = [
                    trigger_display.lower(),
                    trigger_name.replace("_", " "),
                    f"when {piece_name} {trigger_display}".lower(),
                    f"new {piece_name}".lower() if "new" in trigger_display.lower() else "",
                ]
                for variant in [v for v in variants if v]:
                    texts_to_embed.append(variant)
                    metadata_list.append({
                        "id": f"trigger_variant:{piece_name}.{trigger_name}",
                        "type": "trigger_variant",
                        "package_name": package_name,
                        "piece_name": piece_name,
                        "trigger_name": trigger_name,
                        "displayName": trigger_display,
                    })
        
        print(f"Generating embeddings for {len(texts_to_embed)} texts...")
        
        # Batch embed all texts
        embeddings = self.model.encode(
            texts_to_embed,
            show_progress_bar=True,
            convert_to_numpy=True
        )
        
        # Create embedding entries
        self.embeddings = []
        for i, (text, metadata, embedding) in enumerate(zip(texts_to_embed, metadata_list, embeddings)):
            self.embeddings.append(EmbeddingEntry(
                id=metadata["id"],
                text=text,
                embedding=embedding.tolist(),
                metadata=metadata
            ))
        
        print(f"Generated {len(self.embeddings)} embeddings")
        return self.embeddings
    
    def save(self, output_path: str):
        """Save embeddings to file."""
        data = {
            "model": self.model_name,
            "dimension": len(self.embeddings[0].embedding) if self.embeddings else 0,
            "count": len(self.embeddings),
            "embeddings": [
                {
                    "id": e.id,
                    "text": e.text,
                    "embedding": e.embedding,
                    "metadata": e.metadata
                }
                for e in self.embeddings
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        
        print(f"Saved {len(self.embeddings)} embeddings to {output_path}")
    
    def save_compact(self, output_path: str):
        """Save embeddings in compact numpy format for faster loading."""
        # Save embeddings as numpy array
        embeddings_array = np.array([e.embedding for e in self.embeddings])
        np.save(output_path.replace('.json', '_vectors.npy'), embeddings_array)
        
        # Save metadata separately
        metadata = {
            "model": self.model_name,
            "dimension": len(self.embeddings[0].embedding) if self.embeddings else 0,
            "count": len(self.embeddings),
            "entries": [
                {
                    "id": e.id,
                    "text": e.text,
                    "metadata": e.metadata
                }
                for e in self.embeddings
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f)
        
        print(f"Saved compact embeddings to {output_path}")


class EmbeddingIndex:
    """In-memory vector index for fast similarity search."""
    
    def __init__(self):
        self.embeddings: np.ndarray = None
        self.entries: List[Dict] = []
        self.dimension: int = 0
    
    def load(self, embeddings_path: str):
        """Load embeddings from file."""
        # Try compact format first
        vectors_path = embeddings_path.replace('.json', '_vectors.npy')
        
        if Path(vectors_path).exists():
            # Load compact format
            self.embeddings = np.load(vectors_path)
            with open(embeddings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.entries = data["entries"]
            self.dimension = data["dimension"]
        else:
            # Load full format
            with open(embeddings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.embeddings = np.array([e["embedding"] for e in data["embeddings"]])
            self.entries = [
                {"id": e["id"], "text": e["text"], "metadata": e["metadata"]}
                for e in data["embeddings"]
            ]
            self.dimension = data["dimension"]
        
        print(f"Loaded {len(self.entries)} embeddings (dim={self.dimension})")
    
    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> List[Tuple[Dict, float]]:
        """
        Search for similar items using cosine similarity.
        
        Args:
            query_embedding: Query vector
            top_k: Number of results to return
        
        Returns:
            List of (entry, similarity_score) tuples
        """
        # Normalize query
        query_norm = query_embedding / np.linalg.norm(query_embedding)
        
        # Compute cosine similarities
        embeddings_norm = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        similarities = np.dot(embeddings_norm, query_norm)
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append((self.entries[idx], float(similarities[idx])))
        
        return results


def main():
    """Generate embeddings from knowledge base."""
    import sys
    
    script_dir = Path(__file__).parent
    kb_path = script_dir / "pieces_knowledge_base.json"
    output_path = script_dir / "pieces_embeddings.json"
    
    if len(sys.argv) > 1:
        kb_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_path = Path(sys.argv[2])
    
    if not kb_path.exists():
        print(f"Knowledge base not found: {kb_path}")
        print("Run piece_extractor.py first!")
        sys.exit(1)
    
    generator = EmbeddingGenerator()
    generator.generate_from_knowledge_base(str(kb_path))
    generator.save_compact(str(output_path))


if __name__ == "__main__":
    main()

