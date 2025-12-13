#!/usr/bin/env python3
"""
Build a registry of piece metadata from the actual source code.
This creates a JSON file with correct trigger names, action names, and field names.
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

# Top pieces from training data analysis
TOP_PIECES = [
    "google-sheets",
    "text-ai", 
    "gmail",
    "slack",
    "schedule",
    "utility-ai",
    "google-drive",
    "google-calendar",
    "google-forms",
    "hubspot",
    "date-helper",
    "forms",
    "webhook",
    "telegram-bot",
    "store",
    "http",
    "notion",
    "tables",
    "openai",
    "salesforce",
    "pipedrive",
    "data-mapper",
    "github",
    "airtable",
    "discord",
    "trello",
    "asana",
    "jira-cloud",
    "stripe",
    "twilio",
]

def find_piece_directory(piece_name: str, base_path: str) -> Optional[Path]:
    """Find the directory for a piece."""
    pieces_path = Path(base_path) / "packages" / "pieces" / "community"
    piece_dir = pieces_path / piece_name
    
    if piece_dir.exists():
        return piece_dir
    
    # Try ee pieces
    ee_path = Path(base_path) / "packages" / "pieces" / "ee"
    piece_dir = ee_path / piece_name
    
    if piece_dir.exists():
        return piece_dir
    
    return None

def extract_triggers_from_file(file_path: Path) -> List[Dict[str, Any]]:
    """Extract trigger definitions from a TypeScript file."""
    triggers = []
    
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Check if it's a trigger file
        if 'createTrigger' not in content:
            return triggers
        
        # Find createTrigger block and extract name/displayName
        # Pattern: createTrigger({ ... name: '...', ... displayName: '...', ... })
        trigger_blocks = re.findall(r'createTrigger\s*\(\s*\{', content)
        
        if trigger_blocks:
            # Find the first name: 'xxx' after createTrigger
            # This pattern finds name: 'value' or name: "value" or name: `value`
            name_match = re.search(r"createTrigger\s*\(\s*\{[^}]*?name\s*:\s*['\"`]([^'\"`]+)['\"`]", content, re.DOTALL)
            display_match = re.search(r"createTrigger\s*\(\s*\{[^}]*?displayName\s*:\s*['\"`]([^'\"`]+)['\"`]", content, re.DOTALL)
            
            if name_match:
                name = name_match.group(1)
                display = display_match.group(1) if display_match else name
                
                # Skip if it looks like a template literal variable
                if not name.startswith('$') and not name.startswith('{'):
                    triggers.append({
                        "name": name,
                        "displayName": display,
                        "file": str(file_path.name),
                    })
    except Exception as e:
        pass
    
    return triggers

def extract_actions_from_file(file_path: Path) -> List[Dict[str, Any]]:
    """Extract action definitions from a TypeScript file."""
    actions = []
    
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Check if it's an action file
        if 'createAction' not in content:
            return actions
        
        # Find the first name: 'xxx' after createAction
        name_match = re.search(r"createAction\s*\(\s*\{[^}]*?name\s*:\s*['\"`]([^'\"`]+)['\"`]", content, re.DOTALL)
        display_match = re.search(r"createAction\s*\(\s*\{[^}]*?displayName\s*:\s*['\"`]([^'\"`]+)['\"`]", content, re.DOTALL)
        
        if name_match:
            name = name_match.group(1)
            display = display_match.group(1) if display_match else name
            
            # Skip if it looks like a template literal variable
            if not name.startswith('$') and not name.startswith('{'):
                actions.append({
                    "name": name,
                    "displayName": display,
                    "file": str(file_path.name),
                })
    except Exception as e:
        pass
    
    return actions

def extract_props_from_file(file_path: Path) -> List[str]:
    """Extract property names from a TypeScript file."""
    props = []
    
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Find Property.xxx definitions
        prop_pattern = r"(\w+)\s*:\s*Property\."
        props = re.findall(prop_pattern, content)
        
        # Also look for common prop patterns
        common_prop_pattern = r"props\s*:\s*\{([^}]+)\}"
        
    except Exception as e:
        pass
    
    return list(set(props))

def get_piece_version(piece_dir: Path) -> Optional[str]:
    """Get piece version from package.json."""
    package_json = piece_dir / "package.json"
    
    if package_json.exists():
        try:
            with open(package_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("version")
        except Exception:
            pass
    
    return None

def scan_piece(piece_name: str, base_path: str) -> Optional[Dict[str, Any]]:
    """Scan a piece directory and extract metadata."""
    piece_dir = find_piece_directory(piece_name, base_path)
    
    if not piece_dir:
        return None
    
    result = {
        "name": f"@activepieces/piece-{piece_name}",
        "version": get_piece_version(piece_dir),
        "triggers": [],
        "actions": [],
        "props": [],
    }
    
    # Scan src directory
    src_dir = piece_dir / "src"
    
    if src_dir.exists():
        # Find trigger files (check both 'triggers' and 'trigger' folders)
        for trigger_folder in ["triggers", "trigger"]:
            triggers_dir = src_dir / "lib" / trigger_folder
            if triggers_dir.exists():
                for ts_file in triggers_dir.glob("*.ts"):
                    triggers = extract_triggers_from_file(ts_file)
                    result["triggers"].extend(triggers)
        
        # Find action files (check both 'actions' and 'action' folders)
        for action_folder in ["actions", "action"]:
            actions_dir = src_dir / "lib" / action_folder
            if actions_dir.exists():
                for ts_file in actions_dir.glob("*.ts"):
                    actions = extract_actions_from_file(ts_file)
                    result["actions"].extend(actions)
        
        # Find common props
        common_dir = src_dir / "lib" / "common"
        if common_dir.exists():
            for ts_file in common_dir.glob("*.ts"):
                props = extract_props_from_file(ts_file)
                result["props"].extend(props)
        
        # Also scan index.ts for additional info
        index_file = src_dir / "index.ts"
        if index_file.exists():
            props = extract_props_from_file(index_file)
            result["props"].extend(props)
    
    # Deduplicate
    result["props"] = list(set(result["props"]))
    
    return result

def build_registry(base_path: str) -> Dict[str, Any]:
    """Build the full piece registry."""
    registry = {}
    
    for piece_name in TOP_PIECES:
        print(f"Scanning: {piece_name}")
        piece_data = scan_piece(piece_name, base_path)
        
        if piece_data:
            registry[piece_data["name"]] = piece_data
            print(f"  ✓ Found {len(piece_data['triggers'])} triggers, {len(piece_data['actions'])} actions")
        else:
            print(f"  ✗ Not found")
    
    return registry

def main():
    import sys
    
    base_path = "/home/alien/dev/activepieces"
    
    print("Building piece registry from source code...")
    print("="*60)
    
    registry = build_registry(base_path)
    
    # Save registry
    output_file = "piece_registry.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)
    
    print("\n" + "="*60)
    print(f"✅ Registry saved to: {output_file}")
    print(f"Total pieces: {len(registry)}")
    
    # Print summary
    print("\nRegistry Summary:")
    for piece_name, piece_data in registry.items():
        short_name = piece_name.split("/")[-1]
        print(f"  {short_name}:")
        print(f"    Version: {piece_data['version']}")
        print(f"    Triggers: {[t['name'] for t in piece_data['triggers']]}")
        print(f"    Actions: {[a['name'] for a in piece_data['actions'][:5]]}...")

if __name__ == "__main__":
    main()

