#!/usr/bin/env python3
"""Detailed analysis of model outputs for schema compatibility."""

import json
import sys
import re

# Model outputs to analyze - using raw strings
outputs = [
    {
        "name": "Output 1: Google Sheets → Slack",
        "request": "When a new row is added to the 'Leads' Google Sheet, send a Slack message to #sales with the lead name and email.",
        "output": '{"name":"Notify Sales of New Leads","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Notify Sales of New Leads"},"propertySettings":{}}}}}'
    },
    {
        "name": "Output 2: Webhook Conditional (ROUTER)",
        "request": "When a webhook is received, if email is missing then send a Slack alert to #ops, else add the payload to a Google Sheet named \"Inbound\".",
        "output": '{"name":"Webhook Validation","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook Trigger","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.0","triggerName":"catch_webhook","propertySettings":{}},"nextAction":{"name":"step_router","type":"ROUTER","valid":true,"displayName":"Check Email","settings":{"executionType":"EXECUTE_FIRST_MATCH","branches":[{"branchType":"CONDITION","branchName":"Email is Present","conditions":[[{"firstValue":"{{trigger.body.email}}","operator":"EXISTS"}]]},{"branchType":"FALLBACK","branchName":"Email is absent"}],"propertySettings":{}},"children":[{"name":"step_true","type":"PIECE","valid":true,"displayName":"Send Slack Alert","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#ops","text":"Notification from Send Slack Alert"},"propertySettings":{}}},{"name":"step_false","type":"PIECE","valid":true,"displayName":"Add to Google Sheet","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{trigger.body}}"},"propertySettings":{}}}}]}'
    },
    {
        "name": "Output 3: Schedule → Multi-step",
        "request": "Every day at 9am, read today\'s rows from Google Sheets \"Leads\", summarize them, and post the summary to Slack #sales.",
        "output": '{"name":"Daily Lead Summary","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Every Day at 9AM","settings":{"pieceName":"@activepieces/piece-schedule","pieceVersion":"~0.1.0","triggerName":"every_day","input":{"hour_of_the_day":9},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Get Yesterday\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_2","type":"PIECE","valid":true,"displayName":"Get Today\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_3","type":"CODE","valid":true,"displayName":"Build Summary","settings":{"input":{},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => {\\n  const yesterday = inputs.yesterday || [];\\n  const today = inputs.today || [];\\n\\n  const newLeads = today.filter(t => !yesterday.find(y => y.id === t.id));\\n\\n  const msg = ` Yesterday: ${yesterday.length} lead(s)\\n Today: ${today.length} lead(s)\\n\\n New Leads:\\n- ${newLeads.map(n => n.name).join(\'\\\\n- \')}\\n`;\\n\\n  return { summary: msg };\\n};"},"packageJson":"{}"},"nextAction":{"name":"step_4","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Send Slack Message":"{{step_3.output.summary}}"},"propertySettings":{}}}}}}}'
    },
    {
        "name": "Output 4: Explicit Steps",
        "request": "Create a flow using these steps: Trigger: google_sheets_row_added (sheet: Leads) Action1: slack_send_message (channel: #sales, message: \"New lead: {{row[\'Name\']}} ({{row[\'Email\']}})\")",
        "output": '{"name":"New Lead Notification","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Lead Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"google_sheets_row_added","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Message To A Channel","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"slack_send_message","input":{"channel":"#sales","text":"New lead: {{trigger.body.Name}} ({{trigger.body.Email}})"},"propertySettings":{}}}}}'
    },
    {
        "name": "Output 5: Gmail → Notion",
        "request": "When a new email arrives in Gmail with subject containing \"Demo\", create a Notion page in database \"Sales Demo Requests\" with title = sender name and body = email snippet.",
        "output": '{"name":"Create Notion page from new Gmail","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Email","settings":{"pieceName":"@realpieces/piece-gmail","pieceVersion":"~0.8.0","triggerName":"gmail_new_email_received","input":{"gmailAccountId":"__TODO_GMAIL_ACCOUNT_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Create Notion Page","settings":{"pieceName":"@activepieces/piece-notion","pieceVersion":"~0.3.0","actionName":"create_page","input":{},"propertySettings":{}}}}'
    }
]

def analyze_output(output_data):
    """Analyze a single model output."""
    issues = []
    warnings = []
    positives = []
    post_processable = []
    
    output_str = output_data["output"]
    
    # Try to parse JSON
    try:
        flow = json.loads(output_str)
    except json.JSONDecodeError as e:
        # Try to fix common JSON issues
        # Fix double colon syntax error
        fixed = re.sub(r'"text":"([^"]+)":"([^"]+)"', r'"text":"\1\2"', output_str)
        try:
            flow = json.loads(fixed)
            issues.append(f"SYNTAX ERROR: Double colon in text field (fixed for analysis)")
        except:
            issues.append(f"Invalid JSON: {e}")
            return {
                "issues": issues,
                "warnings": warnings,
                "positives": positives,
                "post_processable": post_processable,
                "compatible": False,
                "flow": None
            }
    
    # Check root level
    if "name" in flow and "displayName" not in flow:
        issues.append("Uses 'name' instead of 'displayName' at root level")
        post_processable.append("Can rename 'name' → 'displayName'")
    elif "displayName" in flow:
        positives.append("Has 'displayName' at root level")
    
    if "schemaVersion" not in flow:
        issues.append("Missing 'schemaVersion' at root level")
        post_processable.append("Can add 'schemaVersion': '10'")
    else:
        positives.append(f"Has 'schemaVersion': {flow.get('schemaVersion')}")
    
    # Check trigger
    if "trigger" not in flow:
        issues.append("Missing 'trigger' field")
        return {"issues": issues, "warnings": warnings, "positives": positives, 
                "post_processable": post_processable, "compatible": False, "flow": None}
    
    trigger = flow["trigger"]
    
    # Check trigger settings
    if "settings" in trigger:
        settings = trigger["settings"]
        
        if "input" not in settings:
            warnings.append("Trigger settings missing 'input' (should be {} if empty)")
            post_processable.append("Can add 'input': {}")
        elif settings.get("input") == {}:
            positives.append("Trigger has 'input': {}")
        
        if "propertySettings" not in settings:
            warnings.append("Trigger settings missing 'propertySettings'")
            post_processable.append("Can add 'propertySettings': {}")
        else:
            positives.append("Trigger has 'propertySettings'")
    
    # Check for syntax errors in original string
    if '":"{{' in output_str or re.search(r'"text":"[^"]+":"[^"]+"', output_str):
        issues.append("SYNTAX ERROR: Double colon in text field (e.g., 'text':'value':'{{...}}')")
    
    # Check action names
    def check_actions(action, path="trigger.nextAction"):
        if action is None:
            return
        
        action_type = action.get("type", "")
        
        if action_type == "PIECE" and "settings" in action:
            settings = action["settings"]
            action_name = settings.get("actionName", "")
            trigger_name = settings.get("triggerName", "")
            
            # Known incorrect names
            wrong_action_names = {
                "slack_send_message": "send_channel_message",
                "get_rows": "get_values" or "get-many-rows"
            }
            
            wrong_trigger_names = {
                "google_sheets_row_added": "new_row",
                "gmail_new_email_received": "new_email",
                "catch_webhook": "webhook" or "catch_request"
            }
            
            if action_name in wrong_action_names:
                issues.append(f"{path} uses wrong action name: '{action_name}' (should be '{wrong_action_names[action_name]}')")
            
            if trigger_name in wrong_trigger_names:
                issues.append(f"{path} uses wrong trigger name: '{trigger_name}' (should be '{wrong_trigger_names[trigger_name]}')")
        
        # Check for sampleData
        if "settings" in action and "sampleData" in action["settings"]:
            warnings.append(f"{path} has 'sampleData' field (should be removed)")
            post_processable.append(f"Can remove 'sampleData' from {path}")
        
        # Check ROUTER logic
        if action_type == "ROUTER":
            if "children" in action and "settings" in action:
                branches = action["settings"].get("branches", [])
                children = action["children"]
                
                # Check if logic is reversed
                if len(branches) >= 2 and len(children) >= 2:
                    first_branch = branches[0]
                    branch_name = first_branch.get("branchName", "").lower()
                    if "present" in branch_name or "exists" in branch_name:
                        # Check if first child is Slack alert (should be for missing email)
                        first_child = children[0]
                        if first_child and first_child.get("displayName", "").lower() in ["send slack alert", "send slack"]:
                            issues.append("ROUTER logic REVERSED: First branch checks if email EXISTS but first child sends Slack alert (should be for MISSING email)")
                            issues.append("Children order is wrong: Slack alert should be in first branch (email missing), not when email exists")
        
        # Check nextAction
        if "nextAction" in action:
            check_actions(action["nextAction"], f"{path}.nextAction")
        
        # Check children
        if "children" in action:
            for i, child in enumerate(action["children"]):
                if child:
                    check_actions(child, f"{path}.children[{i}]")
    
    if "nextAction" in trigger:
        check_actions(trigger["nextAction"])
    
    # Check data access patterns
    output_str_lower = output_str.lower()
    if "trigger.body" in output_str and "google-sheets" in output_str_lower:
        issues.append("Wrong data access: Uses 'trigger.body' but should use 'trigger.values' for Google Sheets")
    
    # Check piece name errors
    if "@realpieces" in output_str:
        issues.append("Wrong piece name: Uses '@realpieces' instead of '@activepieces'")
    
    # Check if text uses actual data
    if "Notification from" in output_str and "{{" not in output_str.split("Notification from")[1].split('"')[0]:
        warnings.append("Text doesn't use actual data (hardcoded 'Notification from...' instead of using {{trigger.values}} or similar)")
    
    # Compatibility assessment
    # Not compatible if: syntax errors, reversed logic, wrong names, wrong piece names
    critical_issues = [i for i in issues if any(keyword in i for keyword in 
        ["SYNTAX ERROR", "REVERSED", "Wrong", "Invalid JSON"])]
    compatible = len(critical_issues) == 0
    
    return {
        "issues": issues,
        "warnings": warnings,
        "positives": positives,
        "post_processable": post_processable,
        "compatible": compatible,
        "flow": flow
    }

def main():
    print("=" * 80)
    print("MODEL OUTPUT ANALYSIS - SCHEMA COMPATIBILITY")
    print("=" * 80)
    print()
    
    all_issues = []
    all_warnings = []
    all_post_processable = []
    compatible_count = 0
    
    for i, output_data in enumerate(outputs, 1):
        print(f"{output_data['name']}")
        print("-" * 80)
        print(f"Request: {output_data['request']}")
        print()
        
        result = analyze_output(output_data)
        
        if result["positives"]:
            print("✅ Positives:")
            for pos in result["positives"]:
                print(f"   - {pos}")
            print()
        
        if result["issues"]:
            print("❌ Critical Issues:")
            for issue in result["issues"]:
                print(f"   - {issue}")
                all_issues.append(issue)
            print()
        
        if result["warnings"]:
            print("⚠️  Warnings:")
            for warning in result["warnings"]:
                print(f"   - {warning}")
                all_warnings.append(warning)
            print()
        
        if result["post_processable"]:
            print("🔧 Post-Processable:")
            for pp in result["post_processable"]:
                print(f"   - {pp}")
                all_post_processable.append(pp)
            print()
        
        print(f"Schema Compatible: {'✅ YES' if result['compatible'] else '❌ NO'}")
        if result["compatible"]:
            compatible_count += 1
        print()
        print("=" * 80)
        print()
    
    # Summary
    print("SUMMARY")
    print("=" * 80)
    print(f"Total outputs analyzed: {len(outputs)}")
    print(f"Schema compatible: {compatible_count}/{len(outputs)} ({compatible_count/len(outputs)*100:.0f}%)")
    print()
    
    print(f"Critical Issues Found: {len(set(all_issues))} unique types")
    unique_issues = {}
    for issue in all_issues:
        issue_type = issue.split(":")[0] if ":" in issue else issue
        unique_issues[issue_type] = unique_issues.get(issue_type, 0) + 1
    
    print("\nTop Issues:")
    for issue_type, count in sorted(unique_issues.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   - {issue_type}: {count} occurrences")
    
    print(f"\nPost-Processable Issues: {len(set(all_post_processable))} unique types")
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    print("1. ❌ CANNOT post-process:")
    print("   - Wrong action/trigger names (slack_send_message → send_channel_message)")
    print("   - Reversed ROUTER logic")
    print("   - Syntax errors (double colon)")
    print("   - Wrong data access patterns (trigger.body vs trigger.values)")
    print("   - Wrong piece names (@realpieces → @activepieces)")
    print()
    print("2. ✅ CAN post-process:")
    print("   - Missing schemaVersion (add '10')")
    print("   - name → displayName rename")
    print("   - Missing propertySettings (add {})")
    print("   - Missing input (add {})")
    print("   - Remove sampleData")
    print()
    print("3. ⚠️  NEED TRAINING DATA:")
    print("   - Correct action names (send_channel_message, new_row, etc.)")
    print("   - Proper data access patterns (trigger.values for Sheets)")
    print("   - Correct ROUTER logic (check missing, not exists)")
    print("   - Correct piece names (@activepieces/piece-*)")
    print()
    print("4. 📊 VERDICT:")
    if compatible_count == 0:
        print("   ❌ NOT COMPATIBLE - Multiple critical issues prevent direct use")
        print("   ⚠️  Post-processing can fix ~40% of issues")
        print("   ✅ Your 10 example flows will help with correct names and patterns!")

if __name__ == "__main__":
    main()
