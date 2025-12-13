#!/usr/bin/env python3
"""
Fix piece versions to match working examples.
The model outputs often have incorrect or outdated versions.
"""

import json
import sys
from typing import Dict, Any

# Default versions based on working examples
DEFAULT_VERSIONS = {
    "@activepieces/piece-google-sheets": "~0.12.20",  # Actual version from package.json
    "@activepieces/piece-slack": "~0.10.16",  # Actual version from package.json
    "@activepieces/piece-schedule": "~0.1.13",
    "@activepieces/piece-gmail": "~0.9.6",
    "@activepieces/piece-openai": "~0.6.0",
    "@activepieces/piece-webhook": "~0.0.1",
    "@activepieces/piece-google-forms": "~0.3.13",
    "@activepieces/piece-hubspot": "~0.3.0",
    "@activepieces/piece-http": "~0.3.0",
}

def fix_piece_version(settings: Dict[str, Any]) -> None:
    """Fix piece version in settings."""
    piece_name = settings.get("pieceName", "")
    current_version = settings.get("pieceVersion", "")
    
    # Use default version if available
    if piece_name in DEFAULT_VERSIONS:
        settings["pieceVersion"] = DEFAULT_VERSIONS[piece_name]
        if current_version != DEFAULT_VERSIONS[piece_name]:
            print(f"  Updated {piece_name}: {current_version} → {DEFAULT_VERSIONS[piece_name]}")

def fix_flow_versions(flow: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively fix piece versions in a flow."""
    
    def fix_action_settings(settings: Dict[str, Any]):
        """Fix piece version in action/trigger settings."""
        if "pieceName" in settings:
            fix_piece_version(settings)
    
    def fix_trigger(trigger: Dict[str, Any]):
        """Fix trigger settings."""
        if trigger.get("type") == "PIECE_TRIGGER":
            settings = trigger.get("settings", {})
            fix_action_settings(settings)
    
    def fix_action(action: Dict[str, Any]):
        """Recursively fix action settings."""
        if action is None:
            return
        
        if action.get("type") == "PIECE":
            settings = action.get("settings", {})
            fix_action_settings(settings)
        
        # Recurse
        if "nextAction" in action:
            fix_action(action["nextAction"])
        if "children" in action:
            for child in action.get("children", []):
                if child:
                    fix_action(child)
    
    # Fix trigger
    if "trigger" in flow:
        fix_trigger(flow["trigger"])
        if "nextAction" in flow["trigger"]:
            fix_action(flow["trigger"]["nextAction"])
    
    # Fix template.trigger if it's a FlowTemplate
    if "template" in flow and "trigger" in flow["template"]:
        fix_trigger(flow["template"]["trigger"])
        if "nextAction" in flow["template"]["trigger"]:
            fix_action(flow["template"]["trigger"]["nextAction"])
    
    return flow

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_piece_versions.py <input_file> [output_file]")
        print("\nFixes piece versions to match working examples:")
        for piece, version in DEFAULT_VERSIONS.items():
            print(f"  {piece}: {version}")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_fixed_versions.json')
    
    print(f"Reading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    print("Fixing piece versions...")
    fixed = fix_flow_versions(flow)
    
    print(f"Writing: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fixed, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fixed flow saved to: {output_file}")

if __name__ == "__main__":
    main()

