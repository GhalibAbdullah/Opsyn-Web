#!/usr/bin/env python3
"""
Workflow Generator - Main RAG pipeline for generating Activepieces workflows.

This ties together:
1. Piece Retriever - Find relevant pieces for user query
2. LLM Client - Generate workflow using Gemini/OpenAI
3. Post-processor - Clean and validate output

Usage:
    from rag.workflow_generator import WorkflowGenerator
    
    generator = WorkflowGenerator()
    result = generator.generate("When a new email arrives, send to Slack")
    print(result["template"])
"""

import json
import re
from pathlib import Path
from typing import Dict, Optional, Any

from .retriever import PieceRetriever
from .llm_client import LLMFactory, LLMClient, WORKFLOW_SYSTEM_PROMPT


class WorkflowGenerator:
    """
    RAG-based workflow generator for Activepieces.
    
    Uses semantic search to find relevant pieces, then LLM to generate workflow.
    """
    
    def __init__(
        self,
        kb_path: Optional[str] = None,
        embeddings_path: Optional[str] = None,
        llm_provider: str = "auto",
        llm_api_key: Optional[str] = None,
        llm_model: Optional[str] = None
    ):
        """
        Initialize the workflow generator.
        
        Args:
            kb_path: Path to pieces_knowledge_base.json
            embeddings_path: Path to pieces_embeddings.json
            llm_provider: "gemini", "openai", or "auto"
            llm_api_key: API key (or use env vars)
            llm_model: Model name (optional)
        """
        # Set default paths
        rag_dir = Path(__file__).parent
        self.kb_path = kb_path or str(rag_dir / "pieces_knowledge_base.json")
        self.embeddings_path = embeddings_path or str(rag_dir / "pieces_embeddings.json")
        
        # Initialize components (lazy loaded)
        self._retriever: Optional[PieceRetriever] = None
        self._llm: Optional[LLMClient] = None
        
        self.llm_provider = llm_provider
        self.llm_api_key = llm_api_key
        self.llm_model = llm_model
    
    @property
    def retriever(self) -> PieceRetriever:
        """Lazy load retriever."""
        if self._retriever is None:
            self._retriever = PieceRetriever(self.kb_path, self.embeddings_path)
        return self._retriever
    
    @property
    def llm(self) -> LLMClient:
        """Lazy load LLM client."""
        if self._llm is None:
            self._llm = LLMFactory.create(
                provider=self.llm_provider,
                api_key=self.llm_api_key,
                model=self.llm_model
            )
        return self._llm
    
    def generate(
        self,
        query: str,
        max_pieces: int = 5,
        include_metadata: bool = True
    ) -> Dict:
        """
        Generate a workflow from natural language description.
        
        Args:
            query: User's workflow description
            max_pieces: Max number of pieces to retrieve for context
            include_metadata: Include generation metadata in result
        
        Returns:
            FlowTemplate dict ready for Activepieces import
        """
        # Step 1: Retrieve relevant pieces
        context = self.retriever.get_context_for_llm(query, max_pieces=max_pieces)
        context_str = self.retriever.format_context_for_prompt(context)
        
        # Step 2: Build prompt
        prompt = self._build_prompt(query, context_str)
        
        # Step 3: Generate with LLM
        response = self.llm.generate(prompt, system_prompt=WORKFLOW_SYSTEM_PROMPT)
        
        # Step 4: Parse and validate JSON
        workflow_json = self._parse_json(response.content)
        
        # Step 5: Post-process (add missing fields, fix structure)
        workflow = self._post_process(workflow_json, context)
        
        # Step 6: Wrap in FlowTemplate format
        result = self._wrap_in_template(workflow)
        
        if include_metadata:
            result["_metadata"] = {
                "query": query,
                "retrieved_pieces": list(context["pieces"].keys()),
                "llm_model": response.model,
                "llm_usage": response.usage,
            }
        
        return result
    
    def _build_prompt(self, query: str, context: str) -> str:
        """Build the prompt for the LLM."""
        return f"""USER REQUEST:
{query}

{context}

Generate a valid Activepieces workflow JSON for this request.
Use ONLY the trigger and action names listed above.
Return ONLY the JSON, no explanations."""
    
    def _parse_json(self, content: str) -> Dict:
        """Parse JSON from LLM response."""
        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from markdown code block
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        
        raise ValueError(f"Could not parse JSON from response: {content[:500]}...")
    
    def _post_process(self, workflow: Dict, context: Dict) -> Dict:
        """Post-process the generated workflow."""
        # Ensure required fields
        if "displayName" not in workflow:
            workflow["displayName"] = "Generated Workflow"
        
        if "trigger" not in workflow:
            raise ValueError("Workflow must have a trigger")
        
        # Process trigger
        self._process_node(workflow["trigger"], context)
        
        return workflow
    
    def _process_node(self, node: Dict, context: Dict, depth: int = 0):
        """Recursively process a workflow node."""
        if not node or not isinstance(node, dict):
            return
        
        # Ensure valid flag
        if "valid" not in node:
            node["valid"] = True
        
        # Ensure displayName
        if "displayName" not in node and "name" in node:
            node["displayName"] = node["name"].replace("_", " ").title()
        
        # Process settings
        settings = node.get("settings", {})
        
        if node.get("type") in ["PIECE", "PIECE_TRIGGER"]:
            # Ensure pieceVersion
            if "pieceVersion" not in settings:
                settings["pieceVersion"] = "~1.0.0"
            
            # Ensure propertySettings
            if "propertySettings" not in settings:
                settings["propertySettings"] = {}
            
            # Ensure input
            if "input" not in settings:
                settings["input"] = {}
            
            node["settings"] = settings
        
        elif node.get("type") == "CODE":
            # Ensure sourceCode
            if "sourceCode" not in settings:
                settings["sourceCode"] = {
                    "packageJson": "{}",
                    "code": "export const code = async (inputs) => {\n  return {};\n};"
                }
            elif "packageJson" not in settings["sourceCode"]:
                settings["sourceCode"]["packageJson"] = "{}"
            
            if "input" not in settings:
                settings["input"] = {}
            
            node["settings"] = settings
        
        elif node.get("type") == "ROUTER":
            # Ensure branches exist
            if "branches" not in settings:
                settings["branches"] = [
                    {"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[]]},
                    {"branchType": "FALLBACK", "branchName": "Otherwise"}
                ]
            if "executionType" not in settings:
                settings["executionType"] = "EXECUTE_FIRST_MATCH"
            
            node["settings"] = settings
            
            # Process children
            for child in node.get("children", []):
                if child:
                    self._process_node(child, context, depth + 1)
        
        # Process nextAction
        if "nextAction" in node and node["nextAction"]:
            self._process_node(node["nextAction"], context, depth + 1)
        
        # Process firstLoopAction (for loops)
        if "firstLoopAction" in node and node["firstLoopAction"]:
            self._process_node(node["firstLoopAction"], context, depth + 1)
    
    def _wrap_in_template(self, workflow: Dict) -> Dict:
        """Wrap workflow in FlowTemplate format for import."""
        display_name = workflow.get("displayName", "Generated Workflow")
        
        # Extract pieces from workflow
        pieces = set()
        self._extract_pieces(workflow.get("trigger", {}), pieces)
        
        # Add required template fields
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
    
    def _extract_pieces(self, node: Dict, pieces: set):
        """Extract piece names from workflow nodes."""
        if not node or not isinstance(node, dict):
            return
        
        settings = node.get("settings", {})
        piece_name = settings.get("pieceName")
        if piece_name:
            pieces.add(piece_name)
        
        # Recurse
        if "nextAction" in node:
            self._extract_pieces(node["nextAction"], pieces)
        
        for child in node.get("children", []):
            if child:
                self._extract_pieces(child, pieces)
        
        if "firstLoopAction" in node:
            self._extract_pieces(node["firstLoopAction"], pieces)


def generate_workflow(
    query: str,
    llm_provider: str = "auto",
    api_key: Optional[str] = None
) -> Dict:
    """
    Convenience function to generate a workflow.
    
    Args:
        query: Natural language workflow description
        llm_provider: "gemini", "openai", or "auto"
        api_key: API key (optional, uses env vars)
    
    Returns:
        FlowTemplate dict
    """
    generator = WorkflowGenerator(
        llm_provider=llm_provider,
        llm_api_key=api_key
    )
    return generator.generate(query)


def main():
    """Test the workflow generator."""
    import sys
    
    # Check if knowledge base exists
    rag_dir = Path(__file__).parent
    kb_path = rag_dir / "pieces_knowledge_base.json"
    embeddings_path = rag_dir / "pieces_embeddings.json"
    
    if not kb_path.exists():
        print("Knowledge base not found!")
        print("Run: python -m rag.piece_extractor")
        sys.exit(1)
    
    if not embeddings_path.exists():
        print("Embeddings not found!")
        print("Run: python -m rag.embedding_generator")
        sys.exit(1)
    
    # Test queries
    test_queries = [
        "When a new email arrives in Gmail, send a notification to Slack",
        "Every day at 9am, read from Google Sheets and send summary email",
    ]
    
    print("Testing Workflow Generator")
    print("=" * 60)
    
    try:
        generator = WorkflowGenerator()
        
        for query in test_queries:
            print(f"\nQuery: {query}")
            print("-" * 60)
            
            result = generator.generate(query)
            
            print(f"Retrieved pieces: {result.get('_metadata', {}).get('retrieved_pieces', [])}")
            print(f"Generated workflow:")
            
            # Print summary
            template = result.get("template", {})
            trigger = template.get("trigger", {})
            print(f"  Trigger: {trigger.get('settings', {}).get('pieceName')} - {trigger.get('settings', {}).get('triggerName')}")
            
            next_action = trigger.get("nextAction", {})
            while next_action:
                print(f"  Action: {next_action.get('settings', {}).get('pieceName')} - {next_action.get('settings', {}).get('actionName')}")
                next_action = next_action.get("nextAction")
            
            # Save to file
            output_path = rag_dir / f"test_output_{hash(query) % 10000}.json"
            with open(output_path, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nSaved to: {output_path}")
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

