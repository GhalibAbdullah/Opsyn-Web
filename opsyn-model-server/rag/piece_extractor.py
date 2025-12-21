#!/usr/bin/env python3
"""
Piece Extractor - Parses Activepieces TypeScript files to extract pieces.

This script scans the packages/pieces directory and extracts:
- Piece metadata (name, displayName, description)
- All actions (name, displayName, description, props schema)
- All triggers (name, displayName, description, props schema)

Run during build time to generate pieces_knowledge_base.json
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed


@dataclass
class PropSchema:
    """Schema for a property/input field."""
    name: str
    type: str
    displayName: str
    description: str
    required: bool
    default: Optional[Any] = None


@dataclass
class ActionSchema:
    """Schema for a piece action."""
    name: str
    displayName: str
    description: str
    props: List[PropSchema]


@dataclass
class TriggerSchema:
    """Schema for a piece trigger."""
    name: str
    displayName: str
    description: str
    props: List[PropSchema]
    trigger_type: str  # POLLING, WEBHOOK, APP_WEBHOOK


@dataclass
class PieceSchema:
    """Complete schema for a piece."""
    package_name: str  # @activepieces/piece-gmail
    name: str  # gmail
    displayName: str
    description: str
    categories: List[str]
    actions: List[ActionSchema]
    triggers: List[TriggerSchema]
    auth_required: bool
    auth_type: Optional[str]  # OAuth2, SecretText, etc.


class PieceExtractor:
    """Extracts piece definitions from TypeScript files."""
    
    def __init__(self, pieces_base_path: str):
        self.pieces_base_path = Path(pieces_base_path)
        self.pieces: List[PieceSchema] = []
    
    def extract_all(self) -> List[PieceSchema]:
        """Extract all pieces from the codebase."""
        piece_dirs = self._find_piece_directories()
        
        print(f"Found {len(piece_dirs)} piece directories")
        
        # Process in parallel for speed
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(self._extract_piece, piece_dir): piece_dir 
                for piece_dir in piece_dirs
            }
            
            for future in as_completed(futures):
                piece_dir = futures[future]
                try:
                    piece = future.result()
                    if piece:
                        self.pieces.append(piece)
                except Exception as e:
                    print(f"Error extracting {piece_dir}: {e}")
        
        print(f"Successfully extracted {len(self.pieces)} pieces")
        return self.pieces
    
    def _find_piece_directories(self) -> List[Path]:
        """Find all piece directories in the codebase."""
        piece_dirs = []
        
        # Community pieces
        community_path = self.pieces_base_path / "community"
        if community_path.exists():
            for item in community_path.iterdir():
                if item.is_dir() and (item / "src" / "index.ts").exists():
                    piece_dirs.append(item)
        
        # Official pieces (if separate directory)
        official_path = self.pieces_base_path / "official"
        if official_path.exists():
            for item in official_path.iterdir():
                if item.is_dir() and (item / "src" / "index.ts").exists():
                    piece_dirs.append(item)
        
        return piece_dirs
    
    def _extract_piece(self, piece_dir: Path) -> Optional[PieceSchema]:
        """Extract a single piece from its directory."""
        index_file = piece_dir / "src" / "index.ts"
        if not index_file.exists():
            return None
        
        try:
            content = index_file.read_text(encoding='utf-8')
            
            # Extract piece name from directory
            piece_name = piece_dir.name
            package_name = f"@activepieces/piece-{piece_name}"
            
            # Extract createPiece call
            piece_info = self._parse_create_piece(content)
            if not piece_info:
                return None
            
            # Extract actions
            actions = self._extract_actions(piece_dir, content)
            
            # Extract triggers
            triggers = self._extract_triggers(piece_dir, content)
            
            # Extract auth info
            auth_required, auth_type = self._extract_auth_info(content)
            
            return PieceSchema(
                package_name=package_name,
                name=piece_name,
                displayName=piece_info.get("displayName", piece_name.title()),
                description=piece_info.get("description", ""),
                categories=piece_info.get("categories", []),
                actions=actions,
                triggers=triggers,
                auth_required=auth_required,
                auth_type=auth_type
            )
        except Exception as e:
            print(f"Error parsing {piece_dir}: {e}")
            return None
    
    def _parse_create_piece(self, content: str) -> Optional[Dict]:
        """Parse createPiece() call to extract piece metadata."""
        # Match createPiece({ ... })
        match = re.search(
            r'createPiece\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}',
            content, 
            re.DOTALL
        )
        if not match:
            return None
        
        piece_body = match.group(1)
        
        result = {}
        
        # Extract displayName
        display_match = re.search(r"displayName:\s*['\"]([^'\"]+)['\"]", piece_body)
        if display_match:
            result["displayName"] = display_match.group(1)
        
        # Extract description
        desc_match = re.search(r"description:\s*['\"]([^'\"]+)['\"]", piece_body)
        if desc_match:
            result["description"] = desc_match.group(1)
        
        # Extract categories
        cat_match = re.search(r"categories:\s*\[(.*?)\]", piece_body, re.DOTALL)
        if cat_match:
            categories_str = cat_match.group(1)
            categories = re.findall(r"PieceCategory\.(\w+)", categories_str)
            result["categories"] = categories
        
        return result
    
    def _extract_actions(self, piece_dir: Path, index_content: str) -> List[ActionSchema]:
        """Extract all actions from a piece."""
        actions = []
        actions_dir = piece_dir / "src" / "lib" / "actions"
        
        if not actions_dir.exists():
            return actions
        
        for action_file in actions_dir.glob("*.ts"):
            try:
                action = self._parse_action_file(action_file)
                if action:
                    actions.append(action)
            except Exception as e:
                print(f"Error parsing action {action_file}: {e}")
        
        return actions
    
    def _extract_triggers(self, piece_dir: Path, index_content: str) -> List[TriggerSchema]:
        """Extract all triggers from a piece."""
        triggers = []
        triggers_dir = piece_dir / "src" / "lib" / "triggers"
        
        if not triggers_dir.exists():
            return triggers
        
        for trigger_file in triggers_dir.glob("*.ts"):
            try:
                trigger = self._parse_trigger_file(trigger_file)
                if trigger:
                    triggers.append(trigger)
            except Exception as e:
                print(f"Error parsing trigger {trigger_file}: {e}")
        
        return triggers
    
    def _parse_action_file(self, file_path: Path) -> Optional[ActionSchema]:
        """Parse an action TypeScript file."""
        content = file_path.read_text(encoding='utf-8')
        
        # Match createAction({ name: '...', displayName: '...', ... })
        match = re.search(
            r'createAction\s*\(\s*\{([\s\S]*?)\}\s*\)',
            content
        )
        if not match:
            return None
        
        action_body = match.group(1)
        
        # Extract name
        name_match = re.search(r"name:\s*['\"]([^'\"]+)['\"]", action_body)
        name = name_match.group(1) if name_match else file_path.stem.replace("-", "_")
        
        # Extract displayName
        display_match = re.search(r"displayName:\s*['\"]([^'\"]+)['\"]", action_body)
        displayName = display_match.group(1) if display_match else name.replace("_", " ").title()
        
        # Extract description
        desc_match = re.search(r"description:\s*['\"]([^'\"]+)['\"]", action_body)
        description = desc_match.group(1) if desc_match else ""
        
        # Extract props
        props = self._extract_props(action_body)
        
        return ActionSchema(
            name=name,
            displayName=displayName,
            description=description,
            props=props
        )
    
    def _parse_trigger_file(self, file_path: Path) -> Optional[TriggerSchema]:
        """Parse a trigger TypeScript file."""
        content = file_path.read_text(encoding='utf-8')
        
        # Match createTrigger({ name: '...', ... })
        match = re.search(
            r'createTrigger\s*\(\s*\{([\s\S]*?type:\s*TriggerStrategy\.\w+[\s\S]*?)\}',
            content
        )
        if not match:
            return None
        
        trigger_body = match.group(1)
        
        # Extract name
        name_match = re.search(r"name:\s*['\"]([^'\"]+)['\"]", trigger_body)
        name = name_match.group(1) if name_match else file_path.stem.replace("-", "_")
        
        # Extract displayName
        display_match = re.search(r"displayName:\s*['\"]([^'\"]+)['\"]", trigger_body)
        displayName = display_match.group(1) if display_match else name.replace("_", " ").title()
        
        # Extract description
        desc_match = re.search(r"description:\s*['\"]([^'\"]+)['\"]", trigger_body)
        description = desc_match.group(1) if desc_match else ""
        
        # Extract trigger type
        type_match = re.search(r"type:\s*TriggerStrategy\.(\w+)", trigger_body)
        trigger_type = type_match.group(1) if type_match else "POLLING"
        
        # Extract props
        props = self._extract_props(trigger_body)
        
        return TriggerSchema(
            name=name,
            displayName=displayName,
            description=description,
            props=props,
            trigger_type=trigger_type
        )
    
    def _extract_props(self, body: str) -> List[PropSchema]:
        """Extract property definitions from action/trigger body."""
        props = []
        
        # Match props: { propName: Property.Type({...}), ... }
        props_match = re.search(r"props:\s*\{([\s\S]*?)\},?\s*(?:async\s+run|run\s*\(|sampleData)", body)
        if not props_match:
            return props
        
        props_body = props_match.group(1)
        
        # Find each property definition
        prop_pattern = r"(\w+):\s*(?:\w+\.)?Property\.(\w+)\s*\(\s*\{([^}]*)\}"
        for match in re.finditer(prop_pattern, props_body):
            prop_name = match.group(1)
            prop_type = match.group(2)
            prop_config = match.group(3)
            
            # Skip auth property (handled separately)
            if prop_name == "auth":
                continue
            
            # Extract displayName
            display_match = re.search(r"displayName:\s*['\"]([^'\"]+)['\"]", prop_config)
            displayName = display_match.group(1) if display_match else prop_name
            
            # Extract description
            desc_match = re.search(r"description:\s*['\"]([^'\"]+)['\"]", prop_config)
            description = desc_match.group(1) if desc_match else ""
            
            # Extract required
            required_match = re.search(r"required:\s*(true|false)", prop_config)
            required = required_match.group(1) == "true" if required_match else False
            
            props.append(PropSchema(
                name=prop_name,
                type=prop_type,
                displayName=displayName,
                description=description,
                required=required
            ))
        
        return props
    
    def _extract_auth_info(self, content: str) -> tuple:
        """Extract authentication info from piece."""
        # Check for PieceAuth usage
        auth_match = re.search(r"PieceAuth\.(\w+)\s*\(", content)
        if auth_match:
            auth_type = auth_match.group(1)
            return True, auth_type
        
        # Check if auth is used in createPiece
        if "auth:" in content and "PieceAuth" in content:
            return True, "Unknown"
        
        return False, None
    
    def to_dict(self) -> Dict:
        """Convert extracted pieces to dictionary format."""
        return {
            "version": "1.0",
            "pieces_count": len(self.pieces),
            "pieces": {
                piece.package_name: {
                    "name": piece.name,
                    "displayName": piece.displayName,
                    "description": piece.description,
                    "categories": piece.categories,
                    "auth": {
                        "required": piece.auth_required,
                        "type": piece.auth_type
                    },
                    "actions": {
                        action.name: {
                            "displayName": action.displayName,
                            "description": action.description,
                            "props": [asdict(p) for p in action.props]
                        }
                        for action in piece.actions
                    },
                    "triggers": {
                        trigger.name: {
                            "displayName": trigger.displayName,
                            "description": trigger.description,
                            "trigger_type": trigger.trigger_type,
                            "props": [asdict(p) for p in trigger.props]
                        }
                        for trigger in piece.triggers
                    }
                }
                for piece in self.pieces
            }
        }
    
    def save(self, output_path: str):
        """Save extracted pieces to JSON file."""
        data = self.to_dict()
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Saved {len(self.pieces)} pieces to {output_path}")


def main():
    """Extract pieces and save to JSON."""
    import sys
    
    # Default paths
    script_dir = Path(__file__).parent.parent
    pieces_path = script_dir.parent / "packages" / "pieces"
    output_path = script_dir / "rag" / "pieces_knowledge_base.json"
    
    # Allow override from command line
    if len(sys.argv) > 1:
        pieces_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_path = Path(sys.argv[2])
    
    print(f"Extracting pieces from: {pieces_path}")
    
    extractor = PieceExtractor(str(pieces_path))
    extractor.extract_all()
    extractor.save(str(output_path))
    
    # Print summary
    total_actions = sum(len(p.actions) for p in extractor.pieces)
    total_triggers = sum(len(p.triggers) for p in extractor.pieces)
    print(f"\nSummary:")
    print(f"  - Pieces: {len(extractor.pieces)}")
    print(f"  - Actions: {total_actions}")
    print(f"  - Triggers: {total_triggers}")


if __name__ == "__main__":
    main()

