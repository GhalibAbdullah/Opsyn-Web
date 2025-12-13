#!/usr/bin/env python3
"""Convert example flow JSON files to Alpaca training format."""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List

def extract_flow_info(flow_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract key information from a flow to generate instruction."""
    template = flow_data.get("template", {})
    display_name = template.get("displayName", flow_data.get("name", "Unknown Flow"))
    description = flow_data.get("description", "")
    
    trigger = template.get("trigger", {})
    trigger_type = trigger.get("type", "UNKNOWN")
    trigger_display_name = trigger.get("displayName", "")
    trigger_settings = trigger.get("settings", {})
    
    # Get trigger details
    trigger_name = trigger_settings.get("triggerName", "")
    piece_name = trigger_settings.get("pieceName", "")
    
    # Extract piece name (e.g., "@activepieces/piece-slack" -> "slack")
    piece_short = ""
    if piece_name:
        if "/piece-" in piece_name:
            piece_short = piece_name.split("/piece-")[-1]
        elif piece_name.startswith("@activepieces/piece-"):
            piece_short = piece_name.replace("@activepieces/piece-", "")
    
    # Get actions
    actions = []
    action = trigger.get("nextAction")
    while action:
        action_type = action.get("type", "")
        action_display_name = action.get("displayName", "")
        action_settings = action.get("settings", {})
        
        action_piece = action_settings.get("pieceName", "")
        action_name = action_settings.get("actionName", "")
        
        actions.append({
            "type": action_type,
            "displayName": action_display_name,
            "piece": action_piece,
            "actionName": action_name
        })
        
        # Check for ROUTER children
        if action_type == "ROUTER" and "children" in action:
            for child in action.get("children", []):
                if child:
                    child_actions = []
                    child_action = child
                    while child_action:
                        child_actions.append({
                            "type": child_action.get("type", ""),
                            "displayName": child_action.get("displayName", ""),
                        })
                        child_action = child_action.get("nextAction")
                    actions.append({"type": "ROUTER_BRANCH", "actions": child_actions})
        
        action = action.get("nextAction")
    
    return {
        "displayName": display_name,
        "description": description,
        "triggerType": trigger_type,
        "triggerDisplayName": trigger_display_name,
        "triggerName": trigger_name,
        "pieceName": piece_short,
        "actions": actions,
        "template": template
    }

def generate_instruction(flow_info: Dict[str, Any]) -> str:
    """Generate instruction text from flow information."""
    display_name = flow_info["displayName"]
    description = flow_info["description"]
    trigger_display_name = flow_info["triggerDisplayName"]
    trigger_name = flow_info["triggerName"]
    piece_name = flow_info["pieceName"]
    actions = flow_info["actions"]
    
    # Start with description if available
    if description and description.strip():
        return description.strip()
    
    # Build instruction from flow structure
    instruction_parts = []
    
    # Trigger part
    if trigger_name == "every_day" or trigger_name == "every_week":
        if "Daily" in display_name or "daily" in display_name.lower():
            instruction_parts.append("Every day")
        elif "Weekly" in display_name or "weekly" in display_name.lower():
            instruction_parts.append("Every week")
        else:
            instruction_parts.append(f"When {trigger_display_name.lower()}")
    elif trigger_name:
        if trigger_name == "new_row":
            instruction_parts.append("When a new row is added to Google Sheets")
        elif trigger_name == "new_contact":
            instruction_parts.append("When a new contact is created in HubSpot")
        elif trigger_name == "new_response":
            instruction_parts.append("When a new form response is submitted")
        elif trigger_name == "new_email":
            instruction_parts.append("When a new email is received")
        elif trigger_name == "new_file":
            instruction_parts.append("When a new file is added")
        else:
            instruction_parts.append(f"When {trigger_display_name.lower()}")
    else:
        instruction_parts.append(f"When {trigger_display_name.lower()}")
    
    # Action parts
    action_descriptions = []
    for action in actions:
        if action.get("type") == "ROUTER_BRANCH":
            continue  # Skip router branches, handled separately
        
        action_type = action.get("type", "")
        action_display = action.get("displayName", "")
        
        if action_type == "PIECE":
            piece = action.get("piece", "")
            action_name = action.get("actionName", "")
            
            if "slack" in piece.lower():
                if "send" in action_name.lower() or "message" in action_name.lower():
                    action_descriptions.append("send a Slack message")
                else:
                    action_descriptions.append(f"{action_display.lower()}")
            elif "gmail" in piece.lower() or "email" in piece.lower():
                action_descriptions.append("send an email")
            elif "google-sheets" in piece.lower() or "sheets" in piece.lower():
                if "get" in action_name.lower():
                    action_descriptions.append("get data from Google Sheets")
                elif "add" in action_name.lower() or "create" in action_name.lower():
                    action_descriptions.append("add data to Google Sheets")
                else:
                    action_descriptions.append(f"{action_display.lower()}")
            elif "ai" in piece.lower() or "openai" in piece.lower():
                action_descriptions.append("use AI to generate content")
            else:
                action_descriptions.append(f"{action_display.lower()}")
        elif action_type == "CODE":
            action_descriptions.append(f"run code: {action_display.lower()}")
        elif action_type == "ROUTER":
            action_descriptions.append("route based on conditions")
        else:
            action_descriptions.append(f"{action_display.lower()}")
    
    # Combine
    if action_descriptions:
        if len(action_descriptions) == 1:
            instruction_parts.append(action_descriptions[0])
        elif len(action_descriptions) == 2:
            instruction_parts.append(f"{action_descriptions[0]} then {action_descriptions[1]}")
        else:
            instruction_parts.append(", ".join(action_descriptions[:-1]) + f", then {action_descriptions[-1]}")
    
    instruction = ", ".join(instruction_parts) + "."
    
    # Fallback to display name if we couldn't build a good instruction
    if len(instruction) < 20:
        instruction = f"Create a workflow: {display_name}"
    
    return instruction

def convert_flow_to_training_entry(flow_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a flow JSON to training entry format."""
    flow_info = extract_flow_info(flow_data)
    template = flow_info["template"]
    
    # Extract just the flow structure (displayName, trigger, schemaVersion)
    flow_structure = {
        "displayName": template.get("displayName"),
        "trigger": template.get("trigger"),
        "schemaVersion": template.get("schemaVersion", "10")
    }
    
    # Generate instruction
    instruction = generate_instruction(flow_info)
    
    # Create training entry
    return {
        "instruction": instruction,
        "input": "",
        "output": json.dumps(flow_structure, separators=(',', ':'), ensure_ascii=False),
        "system": "You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text."
    }

def main():
    example_flows_dir = Path("example_flows")
    
    if not example_flows_dir.exists():
        print(f"❌ Error: Directory '{example_flows_dir}' not found")
        sys.exit(1)
    
    # Find all JSON files (excluding Zone.Identifier files)
    flow_files = [f for f in example_flows_dir.glob("*.json") 
                  if not f.name.endswith("Zone.Identifier")]
    
    if not flow_files:
        print(f"❌ Error: No JSON files found in '{example_flows_dir}'")
        sys.exit(1)
    
    print(f"Found {len(flow_files)} example flow files\n")
    
    training_entries = []
    
    for flow_file in sorted(flow_files):
        try:
            print(f"Processing: {flow_file.name}")
            
            # Read with UTF-8 BOM handling
            with open(flow_file, 'r', encoding='utf-8-sig') as f:
                flow_data = json.load(f)
            
            # Convert to training entry
            entry = convert_flow_to_training_entry(flow_data)
            
            # Show generated instruction
            print(f"  Instruction: {entry['instruction']}")
            print(f"  Display Name: {json.loads(entry['output']).get('displayName')}")
            print(f"  Schema Version: {json.loads(entry['output']).get('schemaVersion')}")
            print()
            
            training_entries.append(entry)
            
        except Exception as e:
            print(f"  ❌ Error processing {flow_file.name}: {e}\n")
            import traceback
            traceback.print_exc()
    
    # Save to file
    output_file = "example_flows_training_entries.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(training_entries, f, indent=2, ensure_ascii=False)
    
    print("=" * 80)
    print(f"✅ Successfully converted {len(training_entries)} flows to training format")
    print(f"📁 Output saved to: {output_file}")
    print("=" * 80)
    
    # Show sample entry
    if training_entries:
        print("\nSample entry:")
        print(json.dumps(training_entries[0], indent=2))
    
    return training_entries

if __name__ == "__main__":
    main()

