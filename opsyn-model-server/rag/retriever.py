#!/usr/bin/env python3
"""
RAG Retriever - Retrieves relevant pieces for workflow generation.

Given a user query like "When a new email arrives, send to Slack",
retrieves the relevant pieces (Gmail, Slack) with their exact action/trigger names.
"""

import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass


@dataclass
class RetrievedPiece:
    """A retrieved piece with its relevant actions/triggers."""
    package_name: str
    piece_name: str
    displayName: str
    relevance_score: float
    triggers: List[Dict]  # Relevant triggers for this query
    actions: List[Dict]  # Relevant actions for this query


class PieceRetriever:
    """Retrieves relevant pieces for workflow generation."""
    
    def __init__(self, kb_path: str, embeddings_path: str):
        """
        Initialize retriever with knowledge base and embeddings.
        
        Args:
            kb_path: Path to pieces_knowledge_base.json
            embeddings_path: Path to pieces_embeddings.json
        """
        self.kb_path = kb_path
        self.embeddings_path = embeddings_path
        
        self.kb: Dict = None
        self.embeddings: np.ndarray = None
        self.entries: List[Dict] = []
        self.model = None
        
        self._load()
    
    def _load(self):
        """Load knowledge base and embeddings."""
        # Load knowledge base
        with open(self.kb_path, 'r', encoding='utf-8') as f:
            self.kb = json.load(f)
        
        # Load embeddings
        vectors_path = self.embeddings_path.replace('.json', '_vectors.npy')
        
        if Path(vectors_path).exists():
            self.embeddings = np.load(vectors_path)
            with open(self.embeddings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.entries = data["entries"]
        else:
            with open(self.embeddings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.embeddings = np.array([e["embedding"] for e in data["embeddings"]])
            self.entries = [
                {"id": e["id"], "text": e["text"], "metadata": e["metadata"]}
                for e in data["embeddings"]
            ]
        
        print(f"Loaded {len(self.entries)} embeddings and {len(self.kb['pieces'])} pieces")
    
    def _load_embedding_model(self):
        """Lazy load embedding model for query encoding."""
        if self.model is None:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
    
    def _embed_query(self, query: str) -> np.ndarray:
        """Embed a query string."""
        self._load_embedding_model()
        return self.model.encode(query, convert_to_numpy=True)
    
    def retrieve(
        self, 
        query: str, 
        top_k: int = 10,
        min_score: float = 0.3
    ) -> List[RetrievedPiece]:
        """
        Retrieve relevant pieces for a query.
        
        Args:
            query: User's workflow description
            top_k: Max number of results to consider
            min_score: Minimum similarity score to include
        
        Returns:
            List of RetrievedPiece with relevant actions/triggers
        """
        # Embed query
        query_embedding = self._embed_query(query)
        
        # Search
        results = self._search(query_embedding, top_k=top_k * 3)  # Get more for deduplication
        
        # Group by piece and collect relevant actions/triggers
        pieces_map: Dict[str, RetrievedPiece] = {}
        
        for entry, score in results:
            if score < min_score:
                continue
            
            metadata = entry["metadata"]
            package_name = metadata.get("package_name")
            
            if not package_name:
                continue
            
            # Get or create piece entry
            if package_name not in pieces_map:
                piece_info = self.kb["pieces"].get(package_name, {})
                pieces_map[package_name] = RetrievedPiece(
                    package_name=package_name,
                    piece_name=metadata.get("piece_name", ""),
                    displayName=piece_info.get("displayName", ""),
                    relevance_score=score,
                    triggers=[],
                    actions=[]
                )
            
            # Update relevance score to max
            pieces_map[package_name].relevance_score = max(
                pieces_map[package_name].relevance_score, 
                score
            )
            
            entry_type = metadata.get("type", "")
            
            # Add trigger
            if entry_type in ["trigger", "trigger_variant"]:
                trigger_name = metadata.get("trigger_name")
                if trigger_name and not any(
                    t["name"] == trigger_name 
                    for t in pieces_map[package_name].triggers
                ):
                    trigger_info = self.kb["pieces"][package_name].get("triggers", {}).get(trigger_name, {})
                    pieces_map[package_name].triggers.append({
                        "name": trigger_name,
                        "displayName": trigger_info.get("displayName", trigger_name),
                        "description": trigger_info.get("description", ""),
                        "props": trigger_info.get("props", []),
                        "score": score
                    })
            
            # Add action
            if entry_type in ["action", "action_variant"]:
                action_name = metadata.get("action_name")
                if action_name and not any(
                    a["name"] == action_name 
                    for a in pieces_map[package_name].actions
                ):
                    action_info = self.kb["pieces"][package_name].get("actions", {}).get(action_name, {})
                    pieces_map[package_name].actions.append({
                        "name": action_name,
                        "displayName": action_info.get("displayName", action_name),
                        "description": action_info.get("description", ""),
                        "props": action_info.get("props", []),
                        "score": score
                    })
        
        # Sort by relevance
        pieces = sorted(
            pieces_map.values(), 
            key=lambda p: p.relevance_score, 
            reverse=True
        )
        
        return pieces[:top_k]
    
    def _search(self, query_embedding: np.ndarray, top_k: int) -> List[Tuple[Dict, float]]:
        """Vector similarity search."""
        # Normalize
        query_norm = query_embedding / np.linalg.norm(query_embedding)
        embeddings_norm = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        
        # Cosine similarity
        similarities = np.dot(embeddings_norm, query_norm)
        
        # Top-k
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        return [(self.entries[i], float(similarities[i])) for i in top_indices]
    
    def get_context_for_llm(
        self, 
        query: str, 
        max_pieces: int = 5,
        max_actions_per_piece: int = 3,
        max_triggers_per_piece: int = 2
    ) -> Dict:
        """
        Get structured context for LLM prompt.
        
        Returns a dict with pieces, their actions, and triggers
        formatted for injection into LLM prompt.
        """
        pieces = self.retrieve(query, top_k=max_pieces)
        
        context = {
            "pieces": {}
        }
        
        for piece in pieces:
            piece_context = {
                "displayName": piece.displayName,
                "package_name": piece.package_name,
            }
            
            # Add top triggers
            if piece.triggers:
                piece_context["triggers"] = [
                    {
                        "name": t["name"],
                        "displayName": t["displayName"],
                        "description": t["description"],
                    }
                    for t in sorted(piece.triggers, key=lambda x: x.get("score", 0), reverse=True)[:max_triggers_per_piece]
                ]
            
            # Add top actions
            if piece.actions:
                piece_context["actions"] = [
                    {
                        "name": a["name"],
                        "displayName": a["displayName"],
                        "description": a["description"],
                    }
                    for a in sorted(piece.actions, key=lambda x: x.get("score", 0), reverse=True)[:max_actions_per_piece]
                ]
            
            context["pieces"][piece.piece_name] = piece_context
        
        return context
    
    def format_context_for_prompt(self, context: Dict) -> str:
        """Format context as string for LLM prompt."""
        lines = ["AVAILABLE PIECES AND ACTIONS (use ONLY these exact names):"]
        lines.append("")
        
        for piece_name, piece_info in context["pieces"].items():
            lines.append(f"## {piece_info['displayName']} ({piece_info['package_name']})")
            
            if "triggers" in piece_info:
                lines.append("  Triggers:")
                for trigger in piece_info["triggers"]:
                    lines.append(f"    - {trigger['name']}: {trigger['displayName']}")
                    if trigger["description"]:
                        lines.append(f"      Description: {trigger['description']}")
            
            if "actions" in piece_info:
                lines.append("  Actions:")
                for action in piece_info["actions"]:
                    lines.append(f"    - {action['name']}: {action['displayName']}")
                    if action["description"]:
                        lines.append(f"      Description: {action['description']}")
            
            lines.append("")
        
        return "\n".join(lines)


def main():
    """Test the retriever."""
    script_dir = Path(__file__).parent
    kb_path = script_dir / "pieces_knowledge_base.json"
    embeddings_path = script_dir / "pieces_embeddings.json"
    
    if not kb_path.exists() or not embeddings_path.exists():
        print("Knowledge base or embeddings not found!")
        print("Run: python piece_extractor.py && python embedding_generator.py")
        return
    
    retriever = PieceRetriever(str(kb_path), str(embeddings_path))
    
    # Test queries
    test_queries = [
        "When a new email arrives in Gmail, send a message to Slack",
        "Every day at 9am, read Google Sheets and send emails",
        "When a GitHub issue is opened, create a Notion page",
        "Webhook receives data, save to Google Sheets",
    ]
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: {query}")
        print('='*60)
        
        context = retriever.get_context_for_llm(query)
        print(retriever.format_context_for_prompt(context))


if __name__ == "__main__":
    main()

