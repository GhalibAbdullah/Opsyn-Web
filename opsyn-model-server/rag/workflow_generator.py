#!/usr/bin/env python3
"""
RAG Workflow Generator - Generates Activepieces workflows from natural language.

Architecture:
1. Hybrid Retriever - Finds relevant pieces (semantic + keyword search)
2. LLM - Generates MINIMAL workflow structure
3. Post-processor - Handles everything else (from workflow_postprocessor.py)

The LLM only produces the core workflow. Post-processing handles:
- Variable syntax fixing
- Action/trigger name normalization
- Conditional → ROUTER conversion  
- Missing field injection
- FlowTemplate wrapping
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, Optional, List, Set

# Add parent directory to path for importing workflow_postprocessor
sys.path.insert(0, str(Path(__file__).parent.parent))

from .retriever import PieceRetriever
from .llm_client import LLMFactory, LLMClient, WORKFLOW_SYSTEM_PROMPT

# Import the robust post-processor
try:
    from workflow_postprocessor import (
        postprocess,
        validate_workflow,
        validate_and_fix,
        ACTION_NAME_MAP,
        TRIGGER_NAME_MAP,
        KNOWN_ACTIONS,
        KNOWN_TRIGGERS,
    )
    HAS_POSTPROCESSOR = True
except ImportError:
    HAS_POSTPROCESSOR = False
    validate_workflow = None
    validate_and_fix = None
    ACTION_NAME_MAP = {}
    TRIGGER_NAME_MAP = {}
    KNOWN_ACTIONS = {}
    KNOWN_TRIGGERS = {}
    print("Warning: workflow_postprocessor.py not found, using basic post-processing")


class WorkflowGenerator:
    """
    RAG-based workflow generator.
    
    LLM produces minimal output, post-processor handles the rest.
    """
    
    def __init__(
        self,
        kb_path: Optional[str] = None,
        embeddings_path: Optional[str] = None,
        llm_provider: str = "auto",
        llm_api_key: Optional[str] = None,
        llm_model: Optional[str] = None
    ):
        rag_dir = Path(__file__).parent
        self.kb_path = kb_path or str(rag_dir / "pieces_knowledge_base.json")
        self.embeddings_path = embeddings_path or str(rag_dir / "pieces_embeddings.json")
        
        self._retriever: Optional[PieceRetriever] = None
        self._llm: Optional[LLMClient] = None
        
        self.llm_provider = llm_provider
        self.llm_api_key = llm_api_key
        self.llm_model = llm_model
        
        # Build extended action/trigger maps from knowledge base
        self._action_map: Dict[str, str] = {}
        self._trigger_map: Dict[str, str] = {}
    
    @property
    def retriever(self) -> PieceRetriever:
        if self._retriever is None:
            self._retriever = PieceRetriever(self.kb_path, self.embeddings_path)
            self._build_name_maps()
        return self._retriever
    
    @property
    def llm(self) -> LLMClient:
        if self._llm is None:
            self._llm = LLMFactory.create(
                provider=self.llm_provider,
                api_key=self.llm_api_key,
                model=self.llm_model
            )
        return self._llm
    
    def _build_name_maps(self):
        """Build action/trigger name maps from knowledge base."""
        # Start with the robust post-processor maps
        if HAS_POSTPROCESSOR:
            self._action_map = dict(ACTION_NAME_MAP)
            self._trigger_map = dict(TRIGGER_NAME_MAP)
        
        # Add all known actions/triggers from knowledge base
        for pkg_name, piece_info in self._retriever.kb.get("pieces", {}).items():
            # Build canonical names
            for action_name in piece_info.get("actions", {}).keys():
                # Map various formats to canonical name
                camel = self._to_camel_case(action_name)
                self._action_map[camel] = action_name
                self._action_map[action_name.upper()] = action_name
                self._action_map[action_name.lower()] = action_name
            
            for trigger_name in piece_info.get("triggers", {}).keys():
                camel = self._to_camel_case(trigger_name)
                self._trigger_map[camel] = trigger_name
                self._trigger_map[trigger_name.upper()] = trigger_name
                self._trigger_map[trigger_name.lower()] = trigger_name
    
    def _to_camel_case(self, name: str) -> str:
        """Convert snake_case to camelCase."""
        parts = name.split('_')
        return parts[0] + ''.join(p.title() for p in parts[1:])
    
    def generate(self, query: str, max_pieces: int = 8) -> Dict:
        """
        Generate a workflow from natural language.
        
        Args:
            query: User's workflow description
            max_pieces: Max pieces to retrieve for context
        
        Returns:
            FlowTemplate dict ready for Activepieces import
        """
        # Step 1: Retrieve relevant pieces
        context = self.retriever.get_context_for_llm(query, max_pieces=max_pieces)
        context_str = self.retriever.format_context_for_prompt(context)
        
        # Step 2: Build prompt
        prompt = self._build_prompt(query, context_str)
        
        # Step 3: Generate with LLM (minimal output)
        response = self.llm.generate(prompt, system_prompt=WORKFLOW_SYSTEM_PROMPT)
        
        # Step 4: Parse JSON
        raw_workflow = self._parse_json(response.content)
        
        # Step 5: Fix action/trigger names using our maps and query context
        self._fix_names(raw_workflow, context, query)
        
        # Step 6: Apply robust post-processing (pass query for context-aware fixing)
        if HAS_POSTPROCESSOR:
            # Use the full post-processor with validation and query context
            result, errors = validate_and_fix({"output": raw_workflow}, query=query)
            if errors:
                print(f"  Validation warnings: {errors}")
        else:
            # Fallback basic processing
            result = self._basic_postprocess(raw_workflow)
            errors = []
        
        # Add metadata
        result["_metadata"] = {
            "query": query,
            "retrieved_pieces": list(context["pieces"].keys()),
            "llm_model": response.model,
            "llm_usage": response.usage,
            "validation_errors": errors,
        }
        
        return result
    
    def _build_prompt(self, query: str, context: str) -> str:
        """Build prompt for LLM."""
        return f"""Create a workflow for: {query}

{context}

Output ONLY the JSON workflow. Use actionName/triggerName exactly as listed above."""
    
    def _parse_json(self, content: str) -> Dict:
        """Parse JSON from LLM response, handling extra braces."""
        content = content.strip()
        
        # Remove markdown code blocks
        if "```" in content:
            match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
            if match:
                content = match.group(1).strip()
            else:
                content = re.sub(r'```(?:json)?', '', content).strip()
        
        # Direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            error_msg = str(e)
        
        # Handle "Extra data" error - find the valid JSON portion
        if "Extra data" in error_msg:
            result = self._extract_valid_json(content)
            if result:
                return result
        
        # Handle truncated JSON
        repaired = self._repair_json(content)
        if repaired:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass
        
        raise ValueError(f"Could not parse JSON: {content[:200]}...")
    
    def _extract_valid_json(self, content: str) -> Dict:
        """Extract valid JSON by finding balanced braces."""
        if not content.startswith('{'):
            return None
        
        depth = 0
        in_string = False
        escaped = False
        
        for i, char in enumerate(content):
            if escaped:
                escaped = False
                continue
            
            if char == '\\' and in_string:
                escaped = True
                continue
            
            if char == '"' and not escaped:
                in_string = not in_string
                continue
            
            if in_string:
                continue
            
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    # Found the end of the first complete JSON object
                    try:
                        return json.loads(content[:i+1])
                    except json.JSONDecodeError:
                        pass
                    break
        
        return None
    
    def _aggressive_repair(self, content: str) -> str:
        """Very aggressive JSON repair - just close everything."""
        # Find the last valid JSON token
        # Valid endings: }, ], ", true, false, null, numbers
        
        # Remove any trailing garbage
        content = content.rstrip()
        
        # If ends mid-string, close the string
        quote_count = content.count('"') - content.count('\\"')
        if quote_count % 2 == 1:
            content += '"'
        
        # Remove trailing partial tokens
        content = re.sub(r'[,:\s]+$', '', content)
        
        # Close all brackets
        open_braces = content.count('{') - content.count('}')
        open_brackets = content.count('[') - content.count(']')
        
        content += ']' * max(0, open_brackets)
        content += '}' * max(0, open_braces)
        
        return content
    
    def _repair_json(self, content: str) -> str:
        """Attempt to repair truncated JSON by closing brackets."""
        if not content:
            return None
        
        content = content.strip()
        
        # Count brackets
        open_braces = content.count('{')
        close_braces = content.count('}')
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        
        # If balanced, nothing to repair
        if open_braces == close_braces and open_brackets == close_brackets:
            return content
        
        # Fix unbalanced quotes first - find and close incomplete strings
        in_string = False
        escaped = False
        last_good_pos = 0
        
        for i, char in enumerate(content):
            if escaped:
                escaped = False
                continue
            if char == '\\':
                escaped = True
                continue
            if char == '"':
                in_string = not in_string
                if not in_string:
                    last_good_pos = i + 1
            elif not in_string and char in '{}[],':
                last_good_pos = i + 1
        
        # If we ended inside a string, truncate to last good position
        if in_string and last_good_pos > 0:
            content = content[:last_good_pos]
        
        # Remove trailing incomplete parts
        content = content.rstrip()
        content = re.sub(r',\s*$', '', content)  # trailing comma
        content = re.sub(r':\s*$', ':null', content)  # incomplete value
        content = re.sub(r',\s*"[^"]*$', '', content)  # incomplete key
        content = re.sub(r'{\s*"[^"]*$', '{', content)  # incomplete first key
        
        # Recount after fixes
        open_braces = content.count('{') - content.count('}')
        open_brackets = content.count('[') - content.count(']')
        
        # Close remaining brackets - arrays first, then objects
        if open_brackets > 0:
            content += ']' * open_brackets
        if open_braces > 0:
            content += '}' * open_braces
        
        return content
    
    def _fix_names(self, workflow: Dict, context: Dict, query: str = ""):
        """Fix action/trigger names using context, maps, and query context."""
        if "trigger" not in workflow:
            return
        
        # Build lookup of valid names from context
        valid_actions: Dict[str, Set[str]] = {}  # package -> set of action names
        valid_triggers: Dict[str, Set[str]] = {}
        
        for piece_name, piece_info in context["pieces"].items():
            pkg = piece_info["package_name"]
            valid_triggers[pkg] = {t["name"] for t in piece_info.get("triggers", [])}
            valid_actions[pkg] = {a["name"] for a in piece_info.get("actions", [])}
        
        # Also get all actions from KB for this piece
        for piece_name, piece_info in context["pieces"].items():
            pkg = piece_info["package_name"]
            kb_piece = self.retriever.kb["pieces"].get(piece_name, {})
            valid_triggers[pkg].update(kb_piece.get("triggers", {}).keys())
            valid_actions[pkg].update(kb_piece.get("actions", {}).keys())
        
        self._fix_node_names(workflow["trigger"], valid_triggers, valid_actions, is_trigger=True, query_hint=query)
    
    def _fix_node_names(self, node: Dict, valid_triggers: Dict, valid_actions: Dict, is_trigger: bool = False, query_hint: str = ""):
        """Recursively fix node names using query context."""
        if not node or not isinstance(node, dict):
            return
        
        settings = node.get("settings", {})
        node_type = node.get("type", "")
        pkg = settings.get("pieceName", "")
        
        if node_type == "PIECE_TRIGGER" or is_trigger:
            trigger_name = settings.get("triggerName", "")
            
            # Try to fix using our map
            if trigger_name in self._trigger_map:
                fixed = self._trigger_map[trigger_name]
                if fixed != trigger_name:
                    print(f"  Fixed trigger: {trigger_name} → {fixed}")
                    settings["triggerName"] = fixed
                    trigger_name = fixed
            
            # Check if valid for this piece
            if pkg in valid_triggers and trigger_name not in valid_triggers[pkg]:
                available = list(valid_triggers[pkg])
                if available:
                    best = self._find_best_match(trigger_name, available, query_hint)
                    print(f"  Corrected trigger: {trigger_name} → {best}")
                    settings["triggerName"] = best
        
        elif node_type == "PIECE":
            action_name = settings.get("actionName", "")
            
            # Query-aware override: if query asks for sending and this is Slack, use send_channel_message
            if "slack" in pkg.lower() and any(kw in query_hint.lower() for kw in ["send", "message", "notify", "alert"]):
                if action_name != "send_channel_message" and "send_channel_message" in valid_actions.get(pkg, set()):
                    print(f"  Query-aware fix: {action_name} → send_channel_message (Slack)")
                    settings["actionName"] = "send_channel_message"
                    action_name = "send_channel_message"
            
            # Try to fix using our map
            if action_name in self._action_map:
                fixed = self._action_map[action_name]
                if fixed != action_name:
                    print(f"  Fixed action: {action_name} → {fixed}")
                    settings["actionName"] = fixed
                    action_name = fixed
            
            # Check if valid for this piece
            if pkg in valid_actions and action_name not in valid_actions[pkg]:
                available = list(valid_actions[pkg])
                if available:
                    best = self._find_best_match(action_name, available, query_hint)
                    print(f"  Corrected action: {action_name} → {best}")
                    settings["actionName"] = best
        
        # Recurse
        if node.get("nextAction"):
            self._fix_node_names(node["nextAction"], valid_triggers, valid_actions, query_hint=query_hint)
        if node.get("elseNextAction"):
            self._fix_node_names(node["elseNextAction"], valid_triggers, valid_actions, query_hint=query_hint)
        for child in node.get("children", []):
            if child:
                self._fix_node_names(child, valid_triggers, valid_actions, query_hint=query_hint)
    
    def _find_best_match(self, name: str, candidates: List[str], query_hint: str = "") -> str:
        """Find best matching name from candidates, considering query context."""
        name_lower = name.lower().replace("_", "").replace("-", "")
        
        # Exact match
        for c in candidates:
            if c.lower().replace("_", "").replace("-", "") == name_lower:
                return c
        
        # Query-aware matching - if query mentions "send message" prefer send actions
        query_lower = query_hint.lower() if query_hint else ""
        
        if "send" in query_lower or "message" in query_lower or "notify" in query_lower or "alert" in query_lower:
            # Strongly prefer send_channel_message for Slack, send_email for Gmail
            for c in candidates:
                c_lower = c.lower()
                if "send_channel" in c_lower or "send_email" in c_lower or "send_message" in c_lower:
                    return c
            # Fallback to any send action
            for c in candidates:
                if "send" in c.lower():
                    return c
        
        if "read" in query_lower or "get" in query_lower or "find" in query_lower:
            for c in candidates:
                if "get" in c.lower() or "read" in c.lower() or "find" in c.lower():
                    return c
        
        if "create" in query_lower or "add" in query_lower or "insert" in query_lower:
            for c in candidates:
                if "create" in c.lower() or "insert" in c.lower() or "add" in c.lower():
                    return c
        
        # Partial match based on action name
        if "send" in name_lower or "post" in name_lower:
            for c in candidates:
                if "send" in c.lower() or "create" in c.lower() or "insert" in c.lower():
                    return c
        
        if "get" in name_lower or "read" in name_lower or "find" in name_lower:
            for c in candidates:
                if "get" in c.lower() or "read" in c.lower() or "find" in c.lower():
                    return c
        
        # Return first available
        return candidates[0] if candidates else name
    
    def _basic_postprocess(self, workflow: Dict) -> Dict:
        """Basic post-processing fallback."""
        display_name = workflow.get("displayName", "Generated Workflow")
        
        # Add required fields
        def add_fields(node):
            if not node:
                return
            if "valid" not in node:
                node["valid"] = True
            settings = node.get("settings", {})
            if node.get("type") in ["PIECE", "PIECE_TRIGGER"]:
                if "pieceVersion" not in settings:
                    settings["pieceVersion"] = "~1.0.0"
                if "propertySettings" not in settings:
                    settings["propertySettings"] = {}
                if "input" not in settings:
                    settings["input"] = {}
            if node.get("nextAction"):
                add_fields(node["nextAction"])
            for child in node.get("children", []):
                add_fields(child)
        
        add_fields(workflow.get("trigger", {}))
        
        # Extract pieces
        pieces = set()
        def extract(node):
            if not node:
                return
            pkg = node.get("settings", {}).get("pieceName")
            if pkg:
                pieces.add(pkg)
            if node.get("nextAction"):
                extract(node["nextAction"])
            for child in node.get("children", []):
                extract(child)
        extract(workflow.get("trigger", {}))
        
        workflow["agentIds"] = []
        workflow["connectionIds"] = []
        workflow["schemaVersion"] = None
        workflow["valid"] = True
        
        return {
            "name": display_name,
            "description": "",
            "tags": [],
            "pieces": sorted(list(pieces)),
            "schemaVersion": None,
            "template": workflow
        }


def main():
    """Test the workflow generator."""
    rag_dir = Path(__file__).parent
    
    if not (rag_dir / "pieces_knowledge_base.json").exists():
        print("Run: python -m rag.build_knowledge_base")
        return
    
    test_queries = [
        "When a new email arrives in Gmail, send a message to Slack",
        "Every day at 9am, read from Google Sheets and send summary via Gmail",
        "Webhook receives order, if amount > 100 alert Slack, else log to Sheets",
    ]
    
    print("=" * 70)
    print("RAG Workflow Generator (with robust post-processing)")
    print("=" * 70)
    print(f"Post-processor available: {HAS_POSTPROCESSOR}")
    
    generator = WorkflowGenerator()
    
    for query in test_queries:
        print(f"\n{'='*70}")
        print(f"QUERY: {query}")
        print("-" * 70)
        
        try:
            result = generator.generate(query)
            
            print(f"Retrieved: {result['_metadata']['retrieved_pieces']}")
            
            # Summary
            template = result.get("template", {})
            trigger = template.get("trigger", {})
            print(f"Trigger: {trigger.get('settings', {}).get('pieceName')} → {trigger.get('settings', {}).get('triggerName')}")
            
            def show_actions(node, indent=0):
                if not node:
                    return
                t = node.get("type", "")
                s = node.get("settings", {})
                if t == "PIECE":
                    print(f"{'  '*indent}Action: {s.get('pieceName')} → {s.get('actionName')}")
                elif t == "ROUTER":
                    print(f"{'  '*indent}ROUTER ({len(node.get('children', []))} branches)")
                    for i, child in enumerate(node.get("children", [])):
                        print(f"{'  '*(indent+1)}Branch {i+1}:")
                        show_actions(child, indent+2)
                if node.get("nextAction"):
                    show_actions(node["nextAction"], indent)
            
            show_actions(trigger.get("nextAction"))
            
            # Save
            import random
            path = rag_dir / f"test_output_{random.randint(1000,9999)}.json"
            with open(path, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Saved: {path}")
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
