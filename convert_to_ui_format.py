#!/usr/bin/env python3
"""
Convert processed flow to UI import format (FlowTemplate).
The Activepieces UI expects FlowTemplate format, not the API format.
"""

import json
import sys
from typing import Dict, Any, Set, List


def extract_piece_names(trigger: Dict[str, Any]) -> List[str]:
    """Extract all piece names from a flow (trigger + actions)."""
    pieces: Set[str] = set()
    
    # Extract trigger piece
    if trigger.get("type") == "PIECE_TRIGGER":
        settings = trigger.get("settings", {})
        piece_name = settings.get("pieceName")
        if piece_name:
            pieces.add(piece_name)
    
    # Extract action pieces recursively
    def extract_from_action(action: Any):
        if action is None:
            return
        
        action_type = action.get("type", "")
        if action_type == "PIECE":
            settings = action.get("settings", {})
            piece_name = settings.get("pieceName")
            if piece_name:
                pieces.add(piece_name)
        
        # Recurse
        if "nextAction" in action:
            extract_from_action(action["nextAction"])
        if "children" in action:
            for child in action["children"]:
                if child:
                    extract_from_action(child)
    
    if "nextAction" in trigger:
        extract_from_action(trigger["nextAction"])
    
    return sorted(list(pieces))


def convert_to_flow_template(flow: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a processed flow to FlowTemplate format for UI import.
    
    FlowTemplate format:
    {
        "name": string,
        "description": string,
        "tags": string[],
        "pieces": string[],
        "template": {
            "displayName": string,
            "trigger": FlowTrigger,
            "valid": boolean,
            "schemaVersion": string | null
        },
        "blogUrl": string
    }
    """
    display_name = flow.get("displayName", "Untitled Flow")
    trigger = flow.get("trigger", {})
    schema_version = flow.get("schemaVersion", "10")
    
    # Extract piece names
    pieces = extract_piece_names(trigger)
    
    # Determine if trigger is valid
    trigger_valid = trigger.get("valid", True)
    
    # Build FlowTemplate
    template = {
        "name": display_name,
        "description": "",
        "tags": [],
        "pieces": pieces,
        "template": {
            "displayName": display_name,
            "trigger": trigger,
            "valid": trigger_valid,
            "schemaVersion": schema_version
        },
        "blogUrl": ""
    }
    
    return template


def main():
    if len(sys.argv) < 2:
        print("Usage: python convert_to_ui_format.py <input_file> [output_file]")
        print("\nConverts processed flow to FlowTemplate format for UI import.")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "flow_for_ui_import.json"
    
    print(f"Reading flow from: {input_file}")
    
    # Read processed flow
    with open(input_file, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    try:
        # Convert to FlowTemplate format
        print("Converting to FlowTemplate format...")
        template = convert_to_flow_template(flow)
        
        # Save
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(template, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ FlowTemplate saved to: {output_file}")
        print("\n📋 Template Structure:")
        print(f"   name: {template['name']}")
        print(f"   pieces: {len(template['pieces'])} piece(s)")
        print(f"   template.displayName: {template['template']['displayName']}")
        print(f"   template.schemaVersion: {template['template']['schemaVersion']}")
        print(f"   template.valid: {template['template']['valid']}")
        
        print("\n📝 Next Steps:")
        print(f"  1. Import {output_file} into Activepieces UI")
        print("  2. Use 'From local file' option in the UI")
        print("  3. Select this file")
        print("  4. Flow should import successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

