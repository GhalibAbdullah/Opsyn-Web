#!/usr/bin/env python3
"""
Comprehensive field name fixer for all pieces.
Maps common incorrect field names to correct ones based on piece type.
"""

import json
import sys
from typing import Dict, Any

# Field name mappings by piece type
FIELD_NAME_MAPPINGS = {
    "google-sheets": {
        # snake_case → camelCase (Google Sheets uses camelCase!)
        "spreadsheet_id": "spreadsheetId",
        "sheet_id": "sheetId",
        "row_id": "rowId",
        "value_column_a": "valueColumnA",
        "value_column_b": "valueColumnB",
        "value_column_c": "valueColumnC",
        "first_row_headers": "firstRowHeaders",
    },
    "schedule": {
        # Already snake_case, but ensure consistency
        "hourOfTheDay": "hour_of_the_day",
        "runOnWeekends": "run_on_weekends",
    },
    "google-forms": {
        "formId": "form_id",
        "includeTeamDrives": "include_team_drives",
    },
    "gmail": {
        # Gmail uses camelCase, but some fields might be wrong
        "bodyType": "body_type",
        "replyTo": "reply_to",
    },
    "slack": {
        # Slack uses camelCase - these should stay as-is
        # But check for common mistakes
        "unfurlLinks": "unfurlLinks",  # Already correct
        "replyBroadcast": "replyBroadcast",  # Already correct
        "mentionOriginFlow": "mentionOriginFlow",  # Already correct
    }
}

def get_piece_type(piece_name: str) -> str:
    """Extract piece type from piece name."""
    if not piece_name:
        return ""
    # Extract from "@activepieces/piece-google-sheets" → "google-sheets"
    if "/piece-" in piece_name:
        return piece_name.split("/piece-")[-1].lower()
    return piece_name.lower()

def fix_field_names(input_data: Dict[str, Any], piece_type: str) -> Dict[str, Any]:
    """Fix field names in input data based on piece type."""
    if not input_data:
        return input_data
    
    mappings = FIELD_NAME_MAPPINGS.get(piece_type, {})
    fixed = {}
    
    for key, value in input_data.items():
        # Check if this field needs to be renamed
        if key in mappings:
            new_key = mappings[key]
            fixed[new_key] = value
        else:
            fixed[key] = value
    
    return fixed

def fix_property_settings(property_settings: Dict[str, Any], input_data: Dict[str, Any], piece_type: str) -> Dict[str, Any]:
    """Fix propertySettings field names to match input field names."""
    if not property_settings:
        property_settings = {}
    
    mappings = FIELD_NAME_MAPPINGS.get(piece_type, {})
    fixed = {}
    
    for key, value in property_settings.items():
        # Check if this field needs to be renamed
        if key in mappings:
            new_key = mappings[key]
            fixed[new_key] = value
        else:
            fixed[key] = value
    
    # Ensure all input fields have propertySettings entries
    for input_key in input_data.keys():
        # Check if input_key was renamed
        actual_key = mappings.get(input_key, input_key)
        if actual_key not in fixed:
            fixed[actual_key] = {"type": "MANUAL"}
    
    return fixed

def fix_flow_fields(flow: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively fix field names in a flow."""
    
    def fix_action_settings(settings: Dict[str, Any]):
        """Fix field names in action/trigger settings."""
        piece_name = settings.get("pieceName", "")
        piece_type = get_piece_type(piece_name)
        
        # Fix input field names
        if "input" in settings:
            settings["input"] = fix_field_names(settings["input"], piece_type)
        
        # Fix propertySettings field names
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        input_data = settings.get("input", {})
        settings["propertySettings"] = fix_property_settings(
            settings["propertySettings"],
            input_data,
            piece_type
        )
    
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
        print("Usage: python fix_all_field_names.py <input_file> [output_file]")
        print("\nFixes field names for:")
        print("  - Google Sheets: spreadsheetId → spreadsheet_id, sheetId → sheet_id")
        print("  - Schedule: hourOfTheDay → hour_of_the_day")
        print("  - Google Forms: formId → form_id")
        print("  - And more...")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_fixed_fields.json')
    
    print(f"Reading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        flow = json.load(f)
    
    print("Fixing field names for all pieces...")
    fixed = fix_flow_fields(flow)
    
    print(f"Writing: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fixed, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fixed flow saved to: {output_file}")
    print("\nFixed field names:")
    print("  - Google Sheets: spreadsheetId/sheetId → spreadsheet_id/sheet_id")
    print("  - Schedule: hourOfTheDay → hour_of_the_day")
    print("  - Google Forms: formId → form_id")
    print("  - And propertySettings updated to match")

if __name__ == "__main__":
    main()

