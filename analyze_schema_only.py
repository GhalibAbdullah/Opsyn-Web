#!/usr/bin/env python3
"""Analyze model outputs for SCHEMA compatibility only (logic correctness not required)."""

import json
import re

outputs = [
    {
        "name": "Output 1: Google Sheets → Slack",
        "output": '{"name":"Notify Sales of New Leads","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Notify Sales of New Leads"},"propertySettings":{}}}}}'
    },
    {
        "name": "Output 2: Webhook Conditional (ROUTER)",
        "output": '{"name":"Webhook Validation","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook Trigger","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.0","triggerName":"catch_webhook","propertySettings":{}},"nextAction":{"name":"step_router","type":"ROUTER","valid":true,"displayName":"Check Email","settings":{"executionType":"EXECUTE_FIRST_MATCH","branches":[{"branchType":"CONDITION","branchName":"Email is Present","conditions":[[{"firstValue":"{{trigger.body.email}}","operator":"EXISTS"}]]},{"branchType":"FALLBACK","branchName":"Email is absent"}],"propertySettings":{}},"children":[{"name":"step_true","type":"PIECE","valid":true,"displayName":"Send Slack Alert","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#ops","text":"Notification from Send Slack Alert"},"propertySettings":{}}},{"name":"step_false","type":"PIECE","valid":true,"displayName":"Add to Google Sheet","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{trigger.body}}"},"propertySettings":{}}}}]}'
    },
    {
        "name": "Output 3: Schedule → Multi-step",
        "output": '{"name":"Daily Lead Summary","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Every Day at 9AM","settings":{"pieceName":"@activepieces/piece-schedule","pieceVersion":"~0.1.0","triggerName":"every_day","input":{"hour_of_the_day":9},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Get Yesterday\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_2","type":"PIECE","valid":true,"displayName":"Get Today\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_3","type":"CODE","valid":true,"displayName":"Build Summary","settings":{"input":{},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => {\\n  const yesterday = inputs.yesterday || [];\\n  const today = inputs.today || [];\\n\\n  const newLeads = today.filter(t => !yesterday.find(y => y.id === t.id));\\n\\n  const msg = ` Yesterday: ${yesterday.length} lead(s)\\n Today: ${today.length} lead(s)\\n\\n New Leads:\\n- ${newLeads.map(n => n.name).join(\'\\\\n- \')}\\n`;\\n\\n  return { summary: msg };\\n};"},"packageJson":"{}"},"nextAction":{"name":"step_4","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Send Slack Message":"{{step_3.output.summary}}"},"propertySettings":{}}}}}}}'
    },
    {
        "name": "Output 4: Explicit Steps",
        "output": '{"name":"New Lead Notification","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Lead Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"google_sheets_row_added","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Message To A Channel","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"slack_send_message","input":{"channel":"#sales","text":"New lead: {{trigger.body.Name}} ({{trigger.body.Email}})"},"propertySettings":{}}}}}'
    },
    {
        "name": "Output 5: Gmail → Notion",
        "output": '{"name":"Create Notion page from new Gmail","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Email","settings":{"pieceName":"@realpieces/piece-gmail","pieceVersion":"~0.8.0","triggerName":"gmail_new_email_received","input":{"gmailAccountId":"__TODO_GMAIL_ACCOUNT_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Create Notion Page","settings":{"pieceName":"@activepieces/piece-notion","pieceVersion":"~0.3.0","actionName":"create_page","input":{},"propertySettings":{}}}}'
    }
]

def fix_json_syntax(json_str):
    """Fix common JSON syntax errors."""
    # Fix double colon: "text":"value":"{{...}}" -> "text":"value{{...}}"
    # Pattern: "text":"some text":"{{expression}}"
    fixed = re.sub(r'"text":"([^"]+)":"([^"]+)"', r'"text":"\1\2"', json_str)
    # Also handle escaped quotes in the pattern
    fixed = re.sub(r'"text":"([^"]*)"\s*:\s*"([^"]+)"', r'"text":"\1\2"', fixed)
    return fixed

def check_schema_compatibility(output_data):
    """Check if output can be made schema-compatible with post-processing."""
    issues = []
    fixable = []
    unfixable = []
    
    output_str = output_data["output"]
    
    # Try to parse JSON
    try:
        flow = json.loads(output_str)
    except json.JSONDecodeError:
        # Try fixing syntax errors
        fixed_str = fix_json_syntax(output_str)
        try:
            flow = json.loads(fixed_str)
            issues.append("JSON syntax error (fixable)")
            fixable.append("Fix JSON syntax error")
        except:
            issues.append("Invalid JSON (unfixable)")
            unfixable.append("Cannot parse JSON")
            return {
                "schema_compatible": False,
                "fixable": False,
                "issues": issues,
                "fixable_issues": fixable,
                "unfixable_issues": unfixable
            }
    
    # Check root level schema requirements
    if "name" in flow and "displayName" not in flow:
        issues.append("Uses 'name' instead of 'displayName'")
        fixable.append("Rename 'name' → 'displayName'")
    
    if "schemaVersion" not in flow:
        issues.append("Missing 'schemaVersion'")
        fixable.append("Add 'schemaVersion': '10'")
    
    # Check trigger structure
    if "trigger" not in flow:
        issues.append("Missing 'trigger'")
        unfixable.append("Cannot add trigger structure")
        return {
            "schema_compatible": False,
            "fixable": False,
            "issues": issues,
            "fixable_issues": fixable,
            "unfixable_issues": unfixable
        }
    
    trigger = flow["trigger"]
    
    # Check trigger required fields
    required_trigger_fields = ["name", "type", "valid", "displayName", "settings"]
    for field in required_trigger_fields:
        if field not in trigger:
            issues.append(f"Trigger missing '{field}'")
            if field == "settings":
                unfixable.append("Cannot reconstruct trigger settings")
            else:
                fixable.append(f"Add trigger.{field}")
    
    # Check trigger settings
    if "settings" in trigger:
        settings = trigger["settings"]
        
        if "input" not in settings:
            issues.append("Trigger missing 'input'")
            fixable.append("Add trigger.settings.input: {}")
        
        if "propertySettings" not in settings:
            issues.append("Trigger missing 'propertySettings'")
            fixable.append("Add trigger.settings.propertySettings: {}")
    
    # Check actions recursively
    def check_action(action, path="trigger.nextAction"):
        if action is None:
            return
        
        action_type = action.get("type", "")
        required_fields = ["name", "type", "valid", "displayName"]
        
        for field in required_fields:
            if field not in action:
                issues.append(f"{path} missing '{field}'")
                fixable.append(f"Add {path}.{field}")
        
        if "settings" not in action:
            issues.append(f"{path} missing 'settings'")
            unfixable.append(f"Cannot reconstruct {path}.settings")
            return
        
        settings = action["settings"]
        
        if action_type == "PIECE":
            if "pieceName" not in settings:
                issues.append(f"{path} missing 'pieceName'")
                unfixable.append(f"Cannot determine pieceName for {path}")
            if "actionName" not in settings:
                issues.append(f"{path} missing 'actionName'")
                unfixable.append(f"Cannot determine actionName for {path}")
            if "pieceVersion" not in settings:
                issues.append(f"{path} missing 'pieceVersion'")
                fixable.append(f"Add default pieceVersion to {path}")
            if "input" not in settings:
                issues.append(f"{path} missing 'input'")
                fixable.append(f"Add {path}.settings.input: {{}}")
            if "propertySettings" not in settings:
                issues.append(f"{path} missing 'propertySettings'")
                fixable.append(f"Add {path}.settings.propertySettings: {{}}")
        
        elif action_type == "CODE":
            if "sourceCode" not in settings:
                issues.append(f"{path} missing 'sourceCode'")
                unfixable.append(f"Cannot reconstruct code")
            if "input" not in settings:
                issues.append(f"{path} missing 'input'")
                fixable.append(f"Add {path}.settings.input: {{}}")
            if "sampleData" in settings:
                issues.append(f"{path} has 'sampleData'")
                fixable.append(f"Remove {path}.settings.sampleData")
        
        elif action_type == "ROUTER":
            if "branches" not in settings:
                issues.append(f"{path} missing 'branches'")
                unfixable.append(f"Cannot reconstruct ROUTER branches")
            if "children" not in action:
                issues.append(f"{path} missing 'children'")
                unfixable.append(f"Cannot reconstruct ROUTER children")
        
        # Recurse
        if "nextAction" in action:
            check_action(action["nextAction"], f"{path}.nextAction")
        if "children" in action:
            for i, child in enumerate(action["children"]):
                if child:
                    check_action(child, f"{path}.children[{i}]")
    
    if "nextAction" in trigger:
        check_action(trigger["nextAction"])
    
    # Schema compatibility assessment
    # Compatible if: can be fixed with post-processing (no unfixable critical issues)
    schema_compatible = len([u for u in unfixable if "Cannot" in u or "unfixable" in u.lower()]) == 0
    
    return {
        "schema_compatible": schema_compatible,
        "fixable": len(fixable) > 0,
        "issues": issues,
        "fixable_issues": fixable,
        "unfixable_issues": unfixable
    }

def main():
    print("=" * 80)
    print("SCHEMA COMPATIBILITY ANALYSIS (Logic correctness NOT required)")
    print("=" * 80)
    print()
    
    compatible_count = 0
    fixable_count = 0
    
    for i, output_data in enumerate(outputs, 1):
        print(f"{output_data['name']}")
        print("-" * 80)
        
        result = check_schema_compatibility(output_data)
        
        if result["schema_compatible"]:
            compatible_count += 1
            print("✅ SCHEMA COMPATIBLE (can be fixed with post-processing)")
        elif result["fixable"]:
            fixable_count += 1
            print("⚠️  PARTIALLY COMPATIBLE (some issues fixable)")
        else:
            print("❌ NOT COMPATIBLE (critical unfixable issues)")
        
        if result["fixable_issues"]:
            print("\n🔧 Fixable Issues:")
            for issue in result["fixable_issues"]:
                print(f"   ✅ {issue}")
        
        if result["unfixable_issues"]:
            print("\n❌ Unfixable Issues:")
            for issue in result["unfixable_issues"]:
                print(f"   ❌ {issue}")
        
        print()
        print("=" * 80)
        print()
    
    # Summary
    print("SUMMARY")
    print("=" * 80)
    print(f"Total outputs: {len(outputs)}")
    print(f"✅ Schema compatible (fixable): {compatible_count}/{len(outputs)} ({compatible_count/len(outputs)*100:.0f}%)")
    print(f"⚠️  Partially compatible: {fixable_count}/{len(outputs)} ({fixable_count/len(outputs)*100:.0f}%)")
    print(f"❌ Not compatible: {len(outputs) - compatible_count - fixable_count}/{len(outputs)}")
    print()
    print("VERDICT:")
    if compatible_count + fixable_count == len(outputs):
        print("✅ YES - All outputs can be made schema-compatible with post-processing!")
        print("   Users can modify logic after import.")
    elif compatible_count + fixable_count >= len(outputs) * 0.8:
        print("⚠️  MOSTLY - Most outputs can be made schema-compatible")
        print("   Some may need manual fixes.")
    else:
        print("❌ NO - Many outputs have unfixable schema issues")
        print("   Need better training data.")

if __name__ == "__main__":
    main()

