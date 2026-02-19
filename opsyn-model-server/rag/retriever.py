#!/usr/bin/env python3
"""
RAG Retriever - Hybrid search (semantic + keyword) for piece retrieval.

Combines:
1. Semantic search - finds conceptually similar pieces
2. Keyword matching - catches exact/fuzzy matches like "Google Sheets" → "google-sheets"
3. Query expansion - handles aliases and common names
"""

import json
import re
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field


# Common aliases and synonyms for pieces
PIECE_ALIASES = {
    # Google products
    "sheets": ["google-sheets", "google sheets", "spreadsheet"],
    "google sheets": ["google-sheets"],
    "spreadsheet": ["google-sheets"],
    "docs": ["google-docs"],
    "drive": ["google-drive"],
    "google drive": ["google-drive"],
    "calendar": ["google-calendar"],
    "gmail": ["gmail", "email", "mail"],
    "email": ["gmail", "smtp", "imap"],
    "mail": ["gmail", "smtp", "imap"],
    "send email": ["gmail"],
    
    # Communication
    "slack": ["slack"],
    "slack message": ["slack"],
    "discord": ["discord"],
    "teams": ["microsoft-teams"],
    "telegram": ["telegram"],
    "sms": ["twilio"],
    "text message": ["twilio"],
    
    # Project management
    "notion": ["notion"],
    "trello": ["trello"],
    "asana": ["asana"],
    "jira": ["jira"],
    "todoist": ["todoist"],
    "clickup": ["clickup"],
    "task": ["todoist", "asana", "trello"],
    
    # Dev tools
    "github": ["github"],
    "github issue": ["github"],
    "gitlab": ["gitlab"],
    "bitbucket": ["bitbucket"],
    "code": ["code"],
    "javascript": ["code"],
    "validate": ["code"],
    
    # CRM/Sales
    "hubspot": ["hubspot"],
    "salesforce": ["salesforce"],
    "pipedrive": ["pipedrive"],
    "contact": ["hubspot", "salesforce"],
    
    # E-commerce
    "stripe": ["stripe"],
    "payment": ["stripe"],
    "subscription": ["stripe"],
    "shopify": ["shopify"],
    "order": ["shopify"],
    
    # Forms
    "typeform": ["typeform"],
    "form": ["typeform", "google-forms"],
    "survey": ["typeform"],
    
    # AI
    "openai": ["openai"],
    "chatgpt": ["openai"],
    "gpt": ["openai"],
    "ai": ["openai"],
    "scan": ["openai"],
    
    # Data
    "airtable": ["airtable"],
    "database": ["airtable", "notion"],
    
    # Scheduling
    "schedule": ["schedule"],
    "cron": ["schedule"],
    "timer": ["schedule"],
    "every day": ["schedule"],
    "daily": ["schedule"],
    "hourly": ["schedule"],
    "every hour": ["schedule"],
    "daily": ["schedule"],
    "hourly": ["schedule"],
    "weekly": ["schedule"],
    
    # Data/API
    "webhook": ["webhook"],
    "http": ["http"],
    "api": ["http"],
    "rest": ["http"],
    
    # AI
    "openai": ["openai"],
    "gpt": ["openai"],
    "chatgpt": ["openai"],
    "claude": ["anthropic"],
    
    # Storage
    "s3": ["aws-s3", "s3"],
    "dropbox": ["dropbox"],
    "airtable": ["airtable"],
}


@dataclass
class RetrievedPiece:
    """A retrieved piece with its relevant actions/triggers."""
    package_name: str
    piece_name: str
    displayName: str
    relevance_score: float
    triggers: List[Dict] = field(default_factory=list)
    actions: List[Dict] = field(default_factory=list)
    match_type: str = "semantic"  # "semantic", "keyword", or "hybrid"


class PieceRetriever:
    """Hybrid retriever combining semantic and keyword search."""
    
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
        
        # Build piece name index for keyword matching
        self.piece_name_index: Dict[str, str] = {}
        
        self._load()
    
    def _load(self):
        """Load knowledge base and embeddings."""
        # Load knowledge base
        with open(self.kb_path, 'r', encoding='utf-8') as f:
            self.kb = json.load(f)
        
        # Build piece name index
        for package_name, piece_info in self.kb.get("pieces", {}).items():
            # Index by package name variations
            self.piece_name_index[package_name.lower()] = package_name
            
            # Index by display name
            display_name = piece_info.get("displayName", "").lower()
            if display_name:
                self.piece_name_index[display_name] = package_name
            
            # Index by piece name without prefix
            short_name = package_name.replace("@activepieces/piece-", "").lower()
            self.piece_name_index[short_name] = package_name
        
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
    
    def _extract_keywords(self, query: str) -> Set[str]:
        """Extract potential piece names from query."""
        query_lower = query.lower()
        keywords = set()
        
        # Check for aliases
        for alias, pieces in PIECE_ALIASES.items():
            if alias in query_lower:
                keywords.update(pieces)
        
        # Check for direct piece name matches
        for piece_name in self.piece_name_index.keys():
            if piece_name in query_lower:
                keywords.add(piece_name)
        
        # Also extract individual words for fuzzy matching
        words = re.findall(r'\b[a-zA-Z]+\b', query_lower)
        for word in words:
            if word in self.piece_name_index:
                keywords.add(word)
        
        return keywords
    
    def _keyword_search(self, query: str) -> Dict[str, float]:
        """
        Keyword-based piece matching.
        Returns dict of package_name -> score.
        """
        keywords = self._extract_keywords(query)
        scores: Dict[str, float] = {}
        
        for keyword in keywords:
            # Look up in index
            if keyword in self.piece_name_index:
                package_name = self.piece_name_index[keyword]
                # Keyword match gets high score
                scores[package_name] = max(scores.get(package_name, 0), 0.9)
            
            # Also check as substring
            for idx_key, package_name in self.piece_name_index.items():
                if keyword in idx_key or idx_key in keyword:
                    scores[package_name] = max(scores.get(package_name, 0), 0.7)
        
        return scores
    
    def _semantic_search(self, query: str, top_k: int) -> List[Tuple[Dict, float]]:
        """Vector similarity search."""
        query_embedding = self._embed_query(query)
        
        # Normalize
        query_norm = query_embedding / np.linalg.norm(query_embedding)
        embeddings_norm = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        
        # Cosine similarity
        similarities = np.dot(embeddings_norm, query_norm)
        
        # Top-k
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        return [(self.entries[i], float(similarities[i])) for i in top_indices]
    
    def retrieve(
        self, 
        query: str, 
        top_k: int = 10,
        min_score: float = 0.25,
        keyword_boost: float = 0.3
    ) -> List[RetrievedPiece]:
        """
        Hybrid retrieve: combines keyword and semantic search.
        
        Args:
            query: User's workflow description
            top_k: Max number of pieces to return
            min_score: Minimum score to include
            keyword_boost: Bonus score for keyword matches
        
        Returns:
            List of RetrievedPiece with relevant actions/triggers
        """
        # Step 1: Keyword search
        keyword_scores = self._keyword_search(query)
        
        # Step 2: Semantic search
        semantic_results = self._semantic_search(query, top_k=top_k * 5)
        
        # Step 3: Combine results
        pieces_map: Dict[str, RetrievedPiece] = {}
        
        # Add keyword-matched pieces first (high priority)
        for package_name, score in keyword_scores.items():
            if package_name in self.kb.get("pieces", {}):
                piece_info = self.kb["pieces"][package_name]
                piece_name = package_name.replace("@activepieces/piece-", "")
                
                pieces_map[package_name] = RetrievedPiece(
                    package_name=package_name,
                    piece_name=piece_name,
                    displayName=piece_info.get("displayName", piece_name),
                    relevance_score=score,
                    triggers=[],
                    actions=[],
                    match_type="keyword"
                )
                
                # Add ALL triggers and actions for keyword matches
                for trigger_name, trigger_info in piece_info.get("triggers", {}).items():
                    pieces_map[package_name].triggers.append({
                        "name": trigger_name,
                        "displayName": trigger_info.get("displayName", trigger_name),
                        "description": trigger_info.get("description", ""),
                        "props": trigger_info.get("props", []),
                        "score": score
                    })
                
                for action_name, action_info in piece_info.get("actions", {}).items():
                    pieces_map[package_name].actions.append({
                        "name": action_name,
                        "displayName": action_info.get("displayName", action_name),
                        "description": action_info.get("description", ""),
                        "props": action_info.get("props", []),
                        "score": score
                    })
        
        # Add semantic search results
        for entry, score in semantic_results:
            if score < min_score:
                continue
            
            metadata = entry.get("metadata", {})
            package_name = metadata.get("package_name")
            
            if not package_name or package_name not in self.kb.get("pieces", {}):
                continue
            
            # Boost if also keyword matched
            if package_name in keyword_scores:
                score = min(1.0, score + keyword_boost)
            
            # Get or create piece entry
            if package_name not in pieces_map:
                piece_info = self.kb["pieces"].get(package_name, {})
                piece_name = package_name.replace("@activepieces/piece-", "")
                pieces_map[package_name] = RetrievedPiece(
                    package_name=package_name,
                    piece_name=piece_name,
                    displayName=piece_info.get("displayName", piece_name),
                    relevance_score=score,
                    triggers=[],
                    actions=[],
                    match_type="semantic"
                )
            else:
                pieces_map[package_name].match_type = "hybrid"
            
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
    
    def _detect_intent(self, query: str) -> List[str]:
        """
        Detect user intent from query to filter relevant actions.
        
        Returns list of intents: 'send', 'read', 'create', 'update', 'delete', 'condition'
        """
        query_lower = query.lower()
        intents = []
        
        # Sending/messaging intent - HIGH PRIORITY keywords
        send_keywords = ["send", "post", "notify", "alert", "email to", "message to", 
                         "sms", "notification", "send email", "send message", "confirmation"]
        if any(kw in query_lower for kw in send_keywords):
            intents.append("send")
        
        # Creating intent - for making new things
        create_keywords = ["create", "add", "insert", "new", "append", "log", "record", 
                          "write", "save", "make", "generate", "build"]
        if any(kw in query_lower for kw in create_keywords):
            intents.append("create")
        
        # Reading intent - ONLY if explicitly reading/searching
        read_keywords = ["read from", "get from", "fetch", "find", "search", "look up", 
                        "retrieve", "check", "list", "query", "validate"]
        if any(kw in query_lower for kw in read_keywords):
            intents.append("read")
        
        # Updating intent
        update_keywords = ["update", "edit", "modify", "change", "mark as", "set status"]
        if any(kw in query_lower for kw in update_keywords):
            intents.append("update")
        
        # Deleting intent
        if any(kw in query_lower for kw in ["delete", "remove", "clear"]):
            intents.append("delete")
        
        # Conditional intent
        if any(kw in query_lower for kw in ["if ", " if", "condition", "else", "otherwise", ">"]):
            intents.append("condition")
        
        # Default: if no clear intent, assume send and create (most common)
        if not intents:
            intents = ["send", "create"]
        
        return intents
    
    def _filter_actions_by_intent(self, actions: List[Dict], intents: List[str], piece_name: str) -> List[Dict]:
        """Filter and prioritize actions based on detected intent."""
        
        # Priority actions for each piece - ordered by likelihood
        # Format: {piece: {intent: [actions in priority order]}}
        priority_map = {
            "slack": {
                "send": ["send_channel_message"],
                "create": ["send_channel_message", "create_channel"],
                "read": ["get-message"],
            },
            "gmail": {
                "send": ["send_email"],
                "create": ["send_email"],  # "send email" = send intent
                "read": ["get_mail", "search_mail"],
            },
            "smtp": {
                "send": ["send"],
                "create": ["send"],
            },
            "google-sheets": {
                "create": ["insert_row"],
                "send": ["insert_row"],  # "log to sheets" = create
                "read": ["find_rows", "get_values_in_range"],
                "update": ["update_row"],
            },
            "google-drive": {
                "create": ["upload_file", "create_folder"],
                "send": ["upload_file"],  # "save to drive" = create
                "read": ["read_file", "list_files"],
            },
            "discord": {
                "send": ["send_message_webhook"],
                "create": ["send_message_webhook"],
            },
            "notion": {
                "create": ["create_database_item", "create_page"],
                "send": ["create_database_item"],
                "read": ["find_database_item"],
                "update": ["update_database_item"],
            },
            "todoist": {
                "create": ["create_task"],
                "send": ["create_task"],
                "update": ["complete_task"],
            },
            "http": {
                "send": ["send_request"],
                "create": ["send_request"],
                "read": ["send_request"],
            },
            "webhook": {
                "send": ["return_response"],
            },
            "telegram": {
                "send": ["send_text_message"],
            },
            "twilio": {
                "send": ["send_sms"],
            },
            "github": {
                "create": ["create_issue", "create_issue_comment"],
                "read": ["get_issue"],
            },
            "trello": {
                "create": ["create_card"],
                "send": ["create_card"],
                "update": ["update_card"],
            },
            "airtable": {
                "create": ["create_record"],
                "read": ["find_records", "list_records"],
                "update": ["update_record"],
            },
            "hubspot": {
                "read": ["search_contacts", "get_contact"],
                "send": ["search_contacts"],  # "check contacts" = read
                "create": ["create_contact", "create_deal"],
            },
            "openai": {
                "send": ["ask_chatgpt"],
                "create": ["ask_chatgpt", "generate_image"],
                "read": ["ask_chatgpt"],
            },
            "asana": {
                "create": ["create_task"],
                "update": ["update_task"],
            },
            "stripe": {
                "read": ["get_customer", "get_subscription"],
            },
            "typeform": {
                "read": ["get_responses"],
            },
            "shopify": {
                "create": ["create_order"],
                "read": ["get_orders"],
            },
            "code": {
                "send": ["run_code", "run_javascript"],
                "create": ["run_code"],
                "read": ["run_code"],  # "validate" often means run code
            },
        }
        
        piece_key = piece_name.lower().replace("-", "")
        matched_priorities = set()
        
        # Find priority actions for this piece based on intents
        for piece, intent_actions in priority_map.items():
            if piece.replace("-", "") in piece_key or piece_key in piece.replace("-", ""):
                for intent in intents:
                    if intent in intent_actions:
                        matched_priorities.update(intent_actions[intent])
        
        # Score and sort actions
        scored_actions = []
        for action in actions:
            name = action["name"]
            name_lower = name.lower()
            score = action.get("score", 0)
            
            # Boost priority actions
            if name in matched_priorities:
                score += 100  # Always show priority actions
            
            # Boost based on intent match
            if "send" in intents and any(kw in name_lower for kw in ["send", "post", "message"]):
                score += 50
            if "read" in intents and any(kw in name_lower for kw in ["get", "find", "read", "search"]):
                score += 50
            if "create" in intents and any(kw in name_lower for kw in ["create", "insert", "add"]):
                score += 50
            if "update" in intents and any(kw in name_lower for kw in ["update", "edit"]):
                score += 50
            
            scored_actions.append((action, score))
        
        # Sort by score and return top actions
        scored_actions.sort(key=lambda x: x[1], reverse=True)
        return [a for a, _ in scored_actions]
    
    def get_context_for_llm(
        self, 
        query: str, 
        max_pieces: int = 8,
        max_actions_per_piece: int = 3,  # Reduced - show fewer, more relevant actions
        max_triggers_per_piece: int = 2
    ) -> Dict:
        """
        Get structured context for LLM prompt.
        Uses intent detection to filter relevant actions.
        """
        pieces = self.retrieve(query, top_k=max_pieces)
        intents = self._detect_intent(query)
        
        context = {
            "pieces": {},
            "piece_packages": {},
            "detected_intents": intents  # For debugging
        }
        
        for piece in pieces:
            piece_context = {
                "displayName": piece.displayName,
                "package_name": f"@activepieces/piece-{piece.piece_name}",
                "match_type": piece.match_type,
            }
            
            # Add triggers (sorted by score)
            if piece.triggers:
                sorted_triggers = sorted(piece.triggers, key=lambda x: x.get("score", 0), reverse=True)
                piece_context["triggers"] = [
                    {
                        "name": t["name"],
                        "displayName": t["displayName"],
                        "description": t.get("description", "")[:80],
                    }
                    for t in sorted_triggers[:max_triggers_per_piece]
                ]
            
            # Add actions - filtered by intent!
            if piece.actions:
                filtered_actions = self._filter_actions_by_intent(piece.actions, intents, piece.piece_name)
                piece_context["actions"] = [
                    {
                        "name": a["name"],
                        "displayName": a["displayName"],
                        "description": a.get("description", "")[:80],
                    }
                    for a in filtered_actions[:max_actions_per_piece]
                ]
            
            context["pieces"][piece.piece_name] = piece_context
            context["piece_packages"][piece.piece_name] = f"@activepieces/piece-{piece.piece_name}"
        
        return context
    
    def format_context_for_prompt(self, context: Dict) -> str:
        """Format context showing the BEST action for each piece."""
        lines = ["AVAILABLE PIECES - Use these EXACT values:"]
        lines.append("")
        
        for piece_name, piece_info in context["pieces"].items():
            pkg = piece_info['package_name']
            display = piece_info["displayName"]
            
            lines.append(f"[{display}]")
            lines.append(f"  pieceName: \"{pkg}\"")
            
            # Show triggers
            if "triggers" in piece_info and piece_info["triggers"]:
                triggers = piece_info["triggers"][:2]  # Show up to 2
                trigger_names = ", ".join([f'"{t["name"]}"' for t in triggers])
                lines.append(f"  triggerName: {trigger_names}")
            
            # Show actions - top 2 with descriptions
            if "actions" in piece_info and piece_info["actions"]:
                actions = piece_info["actions"][:2]  # Show up to 2
                for i, a in enumerate(actions):
                    marker = " ← RECOMMENDED" if i == 0 else ""
                    lines.append(f"  actionName: \"{a['name']}\"{marker}")
            
            lines.append("")
        
        return "\n".join(lines)


def main():
    """Test the hybrid retriever."""
    script_dir = Path(__file__).parent
    kb_path = script_dir / "pieces_knowledge_base.json"
    embeddings_path = script_dir / "pieces_embeddings.json"
    
    if not kb_path.exists() or not embeddings_path.exists():
        print("Knowledge base or embeddings not found!")
        print("Run: python -m rag.build_knowledge_base")
        return
    
    retriever = PieceRetriever(str(kb_path), str(embeddings_path))
    
    # Test queries - including ones that failed before
    test_queries = [
        "When a new email arrives in Gmail, send a message to Slack",
        "Every day at 9am, read from Google Sheets and send summary email",
        "When a GitHub issue is opened, create a Notion page",
        "Webhook receives data, if amount > 100 save to Sheets else send Slack alert",
        "New Typeform response, check if score > 80, add to Airtable, send welcome email",
    ]
    
    for query in test_queries:
        print(f"\n{'='*70}")
        print(f"QUERY: {query}")
        print('='*70)
        
        context = retriever.get_context_for_llm(query, max_pieces=6)
        
        print(f"\nRetrieved pieces: {list(context['pieces'].keys())}")
        for name, info in context['pieces'].items():
            match_type = info.get('match_type', 'unknown')
            triggers = [t['name'] for t in info.get('triggers', [])]
            actions = [a['name'] for a in info.get('actions', [])]
            print(f"  {name} ({match_type})")
            if triggers:
                print(f"    Triggers: {triggers[:3]}")
            if actions:
                print(f"    Actions: {actions[:3]}")


if __name__ == "__main__":
    main()
