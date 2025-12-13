#!/usr/bin/env python3
"""
Flow Template Converter

Converts processed flows to FlowTemplate format for UI import.
This is a separate step from robust post-processing.

Usage:
    python flow_template_converter.py processed_flow.json flow_template.json
"""

import json
from typing import Dict, Any, Set


def extract_pieces(obj: Dict[str, Any], pieces: Set[str] = None) -> Set[str]:
    """Extract all piece names from a flow object."""
    if pieces is None:
        pieces = set()
    
    if not obj:
        return pieces
    
    # Check for pieceName in settings
    if "settings" in obj and "pieceName" in obj["settings"]:
        pieces.add(obj["settings"]["pieceName"])
    
    # Recurse into nextAction
    if "nextAction" in obj:
        extract_pieces(obj["nextAction"], pieces)
    
    # Recurse into children (for ROUTER)
    if "children" in obj:
        for child in obj.get("children", []):
            if child:
                extract_pieces(child, pieces)
    
    # Recurse into firstLoopAction (for LOOP_ON_ITEMS)
    if "firstLoopAction" in obj:
        extract_pieces(obj["firstLoopAction"], pieces)
    
    return pieces


def convert_to_flow_template(flow: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a processed flow to FlowTemplate format for UI import.
    
    Args:
        flow: Processed flow JSON (output from robust_post_processor)
    
    Returns:
        FlowTemplate dict ready for UI import
    """
    # Extract piece names from the flow
    pieces = set()
    
    if "trigger" in flow:
        extract_pieces(flow["trigger"], pieces)
    
    # Build FlowTemplate
    template = {
        "name": flow.get("displayName", "Imported Flow"),
        "description": flow.get("description", ""),
        "tags": flow.get("tags", []),
        "pieces": sorted(list(pieces)),
        "template": {
            "displayName": flow.get("displayName", "Imported Flow"),
            "trigger": flow.get("trigger", {}),
            "valid": True,
            "schemaVersion": flow.get("schemaVersion", "10"),
        },
        "blogUrl": ""
    }
    
    return template


def convert_file(input_path: str, output_path: str) -> Dict[str, Any]:
    """
    Convert a flow JSON file to FlowTemplate format.
    
    Args:
        input_path: Path to processed flow JSON
        output_path: Path to save FlowTemplate JSON
    
    Returns:
        FlowTemplate dict
    """
    # Read input
    with open(input_path, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    # Check if already FlowTemplate format
    if "template" in flow and "trigger" in flow.get("template", {}):
        print(f"ℹ️  Input is already in FlowTemplate format, returning as-is")
        template = flow
    else:
        # Convert to FlowTemplate
        template = convert_to_flow_template(flow)
    
    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(template, f, indent=2, ensure_ascii=False)
    
    print(f"✅ FlowTemplate saved to: {output_path}")
    return template


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python flow_template_converter.py <input_flow.json> <output_template.json>")
        print("")
        print("Converts a processed flow to FlowTemplate format for UI import.")
        print("")
        print("Steps:")
        print("  1. Run robust_post_processor.py on raw model output")
        print("  2. Run this script to convert to FlowTemplate")
        print("  3. Import FlowTemplate in Activepieces UI")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    convert_file(input_file, output_file)

