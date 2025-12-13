#!/usr/bin/env python3
"""
Robust Post-Processor for Activepieces Flow JSON
Fixes common issues from model outputs to ensure schema compatibility.
"""

import json
import re
from typing import Dict, Any, Optional


class FlowPostProcessor:
    """Post-processes Activepieces flow JSON to ensure schema compatibility."""
    
    def __init__(self, target_schema_version: str = "10"):
        self.target_schema_version = target_schema_version
    
    def fix_json_syntax(self, json_str: str) -> str:
        """Fix common JSON syntax errors."""
        # Fix double colon: "text":"value":"{{...}}" -> "text":"value{{...}}"
        fixed = re.sub(r'"text":"([^"]+)":"([^"]+)"', r'"text":"\1\2"', json_str)
        # Fix any other double colon patterns
        fixed = re.sub(r'":\s*"([^"]+)":\s*"([^"]+)"', r'": "\1\2"', fixed)
        return fixed
    
    def process(self, flow_json: Dict[str, Any]) -> Dict[str, Any]:
        """Process a flow JSON object and fix all issues."""
        # Make a deep copy to avoid modifying original
        flow = json.loads(json.dumps(flow_json))
        
        # 1. Fix root level issues
        flow = self._fix_root_level(flow)
        
        # 2. Fix trigger
        if "trigger" in flow:
            flow["trigger"] = self._fix_trigger(flow["trigger"])
        
        # 3. Fix actions recursively
        if "trigger" in flow and "nextAction" in flow["trigger"]:
            flow["trigger"]["nextAction"] = self._fix_action(
                flow["trigger"]["nextAction"], 
                path="trigger.nextAction"
            )
        
        return flow
    
    def _fix_root_level(self, flow: Dict[str, Any]) -> Dict[str, Any]:
        """Fix root level issues."""
        # Fix name -> displayName
        if "name" in flow and "displayName" not in flow:
            flow["displayName"] = flow.pop("name")
        
        # Fix schemaVersion
        if flow.get("schemaVersion") is None or flow.get("schemaVersion") == "null":
            flow["schemaVersion"] = self.target_schema_version
        elif isinstance(flow.get("schemaVersion"), str) and flow["schemaVersion"].lower() == "null":
            flow["schemaVersion"] = self.target_schema_version
        
        return flow
    
    def _fix_trigger(self, trigger: Dict[str, Any]) -> Dict[str, Any]:
        """Fix trigger issues."""
        # Ensure required fields
        if "type" not in trigger:
            trigger["type"] = "PIECE_TRIGGER"
        if "valid" not in trigger:
            trigger["valid"] = True
        
        # Fix settings
        if "settings" in trigger:
            trigger["settings"] = self._fix_settings(trigger["settings"], is_trigger=True)
        
        return trigger
    
    def _fix_action(self, action: Optional[Dict[str, Any]], path: str = "") -> Optional[Dict[str, Any]]:
        """Recursively fix action issues."""
        if action is None:
            return None
        
        # Fix action type
        action_type = action.get("type", "")
        
        # Fix CONDITION -> ROUTER
        if action_type == "CONDITION":
            action["type"] = "ROUTER"
            # Ensure it has branches if it's now a ROUTER
            if "settings" not in action:
                action["settings"] = {}
            if "branches" not in action["settings"]:
                # Try to create branches from conditions if they exist
                if "conditions" in action.get("settings", {}):
                    conditions = action["settings"]["conditions"]
                    action["settings"]["branches"] = [
                        {
                            "branchType": "CONDITION",
                            "branchName": "Branch 1",
                            "conditions": conditions
                        },
                        {
                            "branchType": "FALLBACK",
                            "branchName": "Otherwise"
                        }
                    ]
                else:
                    action["settings"]["branches"] = [
                        {
                            "branchType": "FALLBACK",
                            "branchName": "Otherwise"
                        }
                    ]
                action["settings"]["executionType"] = "EXECUTE_FIRST_MATCH"
        
        # Ensure required fields
        if "type" not in action:
            action["type"] = "PIECE"
        if "valid" not in action:
            action["valid"] = True
        
        # Fix settings
        if "settings" in action:
            action["settings"] = self._fix_settings(action["settings"], is_trigger=False)
        
        # Remove sampleData
        if "settings" in action and "sampleData" in action["settings"]:
            del action["settings"]["sampleData"]
        
        # Fix nextAction recursively
        if "nextAction" in action:
            action["nextAction"] = self._fix_action(
                action["nextAction"],
                path=f"{path}.nextAction" if path else "nextAction"
            )
        
        # Fix children (for ROUTER)
        if "children" in action:
            fixed_children = []
            for i, child in enumerate(action["children"]):
                fixed_child = self._fix_action(
                    child,
                    path=f"{path}.children[{i}]" if path else f"children[{i}]"
                )
                fixed_children.append(fixed_child)
            action["children"] = fixed_children
        
        return action
    
    def _fix_settings(self, settings: Dict[str, Any], is_trigger: bool = False) -> Dict[str, Any]:
        """Fix settings object."""
        # Ensure input exists
        if "input" not in settings:
            settings["input"] = {}
        
        # Default versions based on working examples from example_flows/
        # This ensures all pieces get correct versions, not just Google Sheets and Slack
        DEFAULT_VERSIONS = {
            # Google services
            "@activepieces/piece-google-sheets": "~0.12.20",  # Actual version from package.json
            "@activepieces/piece-google-forms": "~0.3.13",
            
            # Communication
            "@activepieces/piece-slack": "~0.10.16",  # Actual version from package.json
            "@activepieces/piece-gmail": "~0.9.6",
            
            # Scheduling
            "@activepieces/piece-schedule": "~0.1.13",
            
            # AI/ML
            "@activepieces/piece-ai": "~0.0.2",  # Used in Daily Task Generation & Grading flows
            "@activepieces/piece-openai": "~0.6.0",
            
            # CRM/Integration
            "@activepieces/piece-hubspot": "~0.3.0",
            
            # Web/HTTP
            "@activepieces/piece-webhook": "~0.0.1",
            "@activepieces/piece-http": "~0.3.0",
            
            # Note: If a piece is not in this list, the post-processor will keep
            # the version from the model output (or use default if missing)
        }
        
        # Fix piece version
        piece_name = settings.get("pieceName", "")
        if piece_name in DEFAULT_VERSIONS:
            settings["pieceVersion"] = DEFAULT_VERSIONS[piece_name]
        
        # Field name mappings by piece type
        piece_type = ""
        if "/piece-" in piece_name:
            piece_type = piece_name.split("/piece-")[-1].lower()
        
        # Fix trigger names (only for triggers)
        if is_trigger and "triggerName" in settings:
            TRIGGER_NAME_FIXES = {
                # Google Sheets
                "new_row": "googlesheets_new_row_added",
                "newRow": "googlesheets_new_row_added",
                "new-row": "googlesheets_new_row_added",
                # Google Forms
                "new_form_response": "new_response",
                "newResponse": "new_response",
            }
            trigger_name = settings.get("triggerName", "")
            if trigger_name in TRIGGER_NAME_FIXES:
                settings["triggerName"] = TRIGGER_NAME_FIXES[trigger_name]
        
        # Fix field names based on piece type
        input_data = settings["input"]
        field_mappings = {}
        
        if "google-sheets" in piece_type:
            # Google Sheets uses camelCase for field names (spreadsheetId, sheetId)
            # Convert snake_case to camelCase if needed
            field_mappings = {
                "spreadsheet_id": "spreadsheetId",
                "sheet_id": "sheetId",
                "row_id": "rowId",
                "value_column_a": "valueColumnA",
                "value_column_b": "valueColumnB",
                "value_column_c": "valueColumnC",
                "first_row_headers": "firstRowHeaders",
            }
        elif "schedule" in piece_type:
            field_mappings = {
                "hourOfTheDay": "hour_of_the_day",
                "runOnWeekends": "run_on_weekends",
            }
        elif "google-forms" in piece_type:
            field_mappings = {
                "formId": "form_id",
                "includeTeamDrives": "include_team_drives",
            }
        elif "gmail" in piece_type:
            field_mappings = {
                "bodyType": "body_type",
                "replyTo": "reply_to",
            }
        
        # Apply field name fixes
        for old_name, new_name in field_mappings.items():
            if old_name in input_data:
                input_data[new_name] = input_data.pop(old_name)
        
        # Ensure propertySettings exists
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        # Add propertySettings for input fields if empty
        property_settings = settings["propertySettings"]
        if not property_settings and settings.get("input"):
            for field_name in settings["input"].keys():
                property_settings[field_name] = {"type": "MANUAL"}
        
        # Fix propertySettings field names to match input
        fixed_property_settings = {}
        for key, value in property_settings.items():
            # Check if this field was renamed
            new_key = field_mappings.get(key, key)
            fixed_property_settings[new_key] = value
        settings["propertySettings"] = fixed_property_settings
        
        # Ensure all input fields have propertySettings entries
        for input_key in input_data.keys():
            if input_key not in settings["propertySettings"]:
                settings["propertySettings"][input_key] = {"type": "MANUAL"}
        
        # Remove sampleData
        if "sampleData" in settings:
            del settings["sampleData"]
        
        # Remove inputUiInfo (UI-only field)
        if "inputUiInfo" in settings:
            del settings["inputUiInfo"]
        
        # Remove pieceType (UI-only field)
        if "pieceType" in settings:
            del settings["pieceType"]
        
        # Remove packageType (UI-only field)
        if "packageType" in settings:
            del settings["packageType"]
        
        return settings
    
    def process_string(self, json_str: str) -> Dict[str, Any]:
        """Process a JSON string."""
        # First, try to fix JSON syntax
        fixed_str = self.fix_json_syntax(json_str)
        
        # Parse JSON
        try:
            flow = json.loads(fixed_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON after syntax fixes: {e}")
        
        # Process the flow
        return self.process(flow)
    
    def validate(self, flow: Dict[str, Any]) -> tuple[bool, list[str]]:
        """Validate a processed flow."""
        errors = []
        
        # Check root level
        if "displayName" not in flow:
            errors.append("Missing 'displayName' at root level")
        
        if "schemaVersion" not in flow:
            errors.append("Missing 'schemaVersion' at root level")
        elif flow["schemaVersion"] != self.target_schema_version:
            errors.append(f"schemaVersion is '{flow['schemaVersion']}', expected '{self.target_schema_version}'")
        
        # Check trigger
        if "trigger" not in flow:
            errors.append("Missing 'trigger'")
        else:
            trigger = flow["trigger"]
            required_fields = ["name", "type", "valid", "displayName", "settings"]
            for field in required_fields:
                if field not in trigger:
                    errors.append(f"Trigger missing '{field}'")
            
            if "settings" in trigger:
                settings = trigger["settings"]
                if "propertySettings" not in settings:
                    errors.append("Trigger settings missing 'propertySettings'")
        
        return len(errors) == 0, errors


def post_process_flow(flow_input: str | Dict[str, Any], schema_version: str = "10") -> Dict[str, Any]:
    """
    Convenience function to post-process a flow.
    
    Args:
        flow_input: Either a JSON string or a dict
        schema_version: Target schema version (default: "10")
    
    Returns:
        Processed flow dict
    """
    processor = FlowPostProcessor(target_schema_version=schema_version)
    
    if isinstance(flow_input, str):
        return processor.process_string(flow_input)
    else:
        return processor.process(flow_input)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python post_processor.py <input_file> [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Read input
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Process
    try:
        processor = FlowPostProcessor()
        processed = processor.process_string(content)
        
        # Validate
        is_valid, errors = processor.validate(processed)
        
        if is_valid:
            print("✅ Flow is valid!")
        else:
            print("⚠️  Flow has validation errors:")
            for error in errors:
                print(f"   - {error}")
        
        # Output
        output_json = json.dumps(processed, indent=2, ensure_ascii=False)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_json)
            print(f"\n✅ Processed flow saved to: {output_file}")
        else:
            print("\n" + "=" * 80)
            print("PROCESSED FLOW:")
            print("=" * 80)
            print(output_json)
    
    except Exception as e:
        print(f"❌ Error processing flow: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

