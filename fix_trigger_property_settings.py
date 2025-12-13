#!/usr/bin/env python3
"""
Fix trigger propertySettings to match working examples.
The UI needs propertySettings with field configurations, not empty objects.
"""

import json
import sys

def fix_property_settings(flow: dict) -> dict:
    """Add proper propertySettings to trigger and actions."""
    
    def add_property_settings_to_trigger(trigger: dict):
        """Add propertySettings to trigger based on piece type."""
        if trigger.get("type") != "PIECE_TRIGGER":
            return
        
        settings = trigger.get("settings", {})
        piece_name = settings.get("pieceName", "")
        input_data = settings.get("input", {})
        
        # Initialize propertySettings if missing or empty
        if "propertySettings" not in settings or not settings.get("propertySettings"):
            settings["propertySettings"] = {}
        
        property_settings = settings["propertySettings"]
        
        # Add propertySettings for each input field
        # For Google Sheets new_row trigger
        if "google-sheets" in piece_name.lower() and settings.get("triggerName") == "new_row":
            for field_name in input_data.keys():
                if field_name not in property_settings:
                    property_settings[field_name] = {"type": "MANUAL"}
        
        # For Schedule triggers
        elif "schedule" in piece_name.lower():
            for field_name in ["timezone", "hour_of_the_day", "run_on_weekends"]:
                if field_name not in property_settings:
                    property_settings[field_name] = {"type": "MANUAL"}
        
        # For Slack actions
        elif "slack" in piece_name.lower():
            for field_name in input_data.keys():
                if field_name not in property_settings:
                    property_settings[field_name] = {"type": "MANUAL"}
        
        # Generic fallback: add MANUAL for all input fields
        else:
            for field_name in input_data.keys():
                if field_name not in property_settings:
                    property_settings[field_name] = {"type": "MANUAL"}
    
    def add_property_settings_to_action(action: dict):
        """Add propertySettings to action."""
        if action is None:
            return
        
        action_type = action.get("type", "")
        if action_type == "PIECE":
            settings = action.get("settings", {})
            input_data = settings.get("input", {})
            
            if "propertySettings" not in settings or not settings.get("propertySettings"):
                settings["propertySettings"] = {}
            
            property_settings = settings["propertySettings"]
            
            # Add propertySettings for each input field
            for field_name in input_data.keys():
                if field_name not in property_settings:
                    property_settings[field_name] = {"type": "MANUAL"}
        
        # Recurse
        if "nextAction" in action:
            add_property_settings_to_action(action["nextAction"])
        if "children" in action:
            for child in action.get("children", []):
                if child:
                    add_property_settings_to_action(child)
    
    # Fix trigger
    if "trigger" in flow:
        add_property_settings_to_trigger(flow["trigger"])
        if "nextAction" in flow["trigger"]:
            add_property_settings_to_action(flow["trigger"]["nextAction"])
    
    # Fix template.trigger if it's a FlowTemplate
    if "template" in flow and "trigger" in flow["template"]:
        add_property_settings_to_trigger(flow["template"]["trigger"])
        if "nextAction" in flow["template"]["trigger"]:
            add_property_settings_to_action(flow["template"]["trigger"]["nextAction"])
    
    return flow

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_trigger_property_settings.py <input_file> [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_fixed.json')
    
    print(f"Reading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    print("Fixing propertySettings...")
    fixed = fix_property_settings(flow)
    
    print(f"Writing: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fixed, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fixed flow saved to: {output_file}")
    print("\nKey changes:")
    print("  - Added propertySettings with field configurations")
    print("  - Each input field now has {type: 'MANUAL'} in propertySettings")

if __name__ == "__main__":
    main()

