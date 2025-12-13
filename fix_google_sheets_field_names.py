#!/usr/bin/env python3
"""
Fix Google Sheets field names from camelCase to snake_case.
Google Sheets piece uses snake_case: spreadsheet_id, sheet_id (not spreadsheetId, sheetId)
"""

import json
import sys

def fix_google_sheets_fields(flow: dict) -> dict:
    """Fix Google Sheets field names to use snake_case."""
    
    def fix_action_settings(settings: dict):
        """Fix field names in action settings."""
        piece_name = settings.get("pieceName", "")
        input_data = settings.get("input", {})
        property_settings = settings.get("propertySettings", {})
        
        # Fix Google Sheets fields
        if "google-sheets" in piece_name.lower():
            # Fix input field names
            if "spreadsheetId" in input_data:
                input_data["spreadsheet_id"] = input_data.pop("spreadsheetId")
            if "sheetId" in input_data:
                input_data["sheet_id"] = input_data.pop("sheetId")
            
            # Fix propertySettings field names
            if "spreadsheetId" in property_settings:
                property_settings["spreadsheet_id"] = property_settings.pop("spreadsheetId")
            if "sheetId" in property_settings:
                property_settings["sheet_id"] = property_settings.pop("sheetId")
    
    def fix_trigger(trigger: dict):
        """Fix trigger settings."""
        if trigger.get("type") == "PIECE_TRIGGER":
            settings = trigger.get("settings", {})
            fix_action_settings(settings)
    
    def fix_action(action: dict):
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
        print("Usage: python fix_google_sheets_field_names.py <input_file> [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_fixed_fields.json')
    
    print(f"Reading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    print("Fixing Google Sheets field names (camelCase → snake_case)...")
    fixed = fix_google_sheets_fields(flow)
    
    print(f"Writing: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fixed, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fixed flow saved to: {output_file}")
    print("\nKey changes:")
    print("  - spreadsheetId → spreadsheet_id")
    print("  - sheetId → sheet_id")

if __name__ == "__main__":
    main()

