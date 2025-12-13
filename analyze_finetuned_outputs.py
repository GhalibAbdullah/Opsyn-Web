#!/usr/bin/env python3
"""Analyze outputs from fine-tuned Qwen Coder 7B model."""

import json
import re

outputs = [
    {
        "id": 1,
        "name": "Google Sheets → Slack",
        "request": "When a new row is added to Google Sheets 'Customer Orders', send a Slack message to #orders channel with the customer name and order total.",
        "output": '{"displayName":"New Row Added Trigger Slack Message","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added Trigger","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#orders","text":"Notification from send_channel_message"},"propertySettings":{}}}},"schemaVersion":null}'
    },
    {
        "id": 2,
        "name": "Webhook Conditional",
        "request": "When a webhook is received, if the 'status' field equals 'urgent', send an email alert to support@company.com, otherwise add the payload to Google Sheets 'Webhook Logs'.",
        "output": '{"displayName":"Webhook Trigger Conditional Email Or Insert Row","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook Trigger","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.0.1","triggerName":"catch_webhook","input":{},"propertySettings":{}},"nextAction":{"name":"step_1","type":"CONDITION","valid":true,"displayName":"Check Status","settings":{"executionType":"FALL_THROUGH","conditions":[[{"firstValue":"{{trigger.body.status}}","operator":"TEXT_IS_EXACTLY","secondValue":"urgent"}]]},"children":[{"name":"step_2","type":"PIECE","valid":true,"displayName":"send_email","settings":{"pieceName":"@activepieces/piece-gmail","pieceVersion":"~0.0.1","actionName":"compose_and_send_email","input":{"receiver":["support@company.com"],"subject":"Notification","body":"This is a notification.","body_type":"plain_text"},"propertySettings":{}}},{"name":"step_3","type":"PIECE","valid":true,"displayName":"insert_row","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{trigger.body}}"},"propertySettings":{}}}]}},"schemaVersion":null}'
    },
    {
        "id": 3,
        "name": "Schedule Multi-step",
        "request": "Every Monday at 9 AM, get all rows from Google Sheets 'Weekly Tasks', use AI to generate a summary, and post it to Slack #weekly-updates channel.",
        "output": '{"displayName":"Google Sheets Trigger AI Summarize Text","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Google Sheets Trigger","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","triggerName":"every_hour","input":{"hour_of_the_day":9,"run_on_weekends":false},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"AI Summarize Text","settings":{"pieceName":"@activepieces/piece-openai","pieceVersion":"~0.0.1","actionName":"summarize_text","input":{},"propertySettings":{}},"nextAction":{"name":"step_2","type":"PIECE","valid":true,"displayName":"Slack","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#weekly-updates","text":"Notification from send_channel_message"},"propertySettings":{}}}}}},"schemaVersion":null}'
    },
    {
        "id": 4,
        "name": "Form Submission with Enrichment",
        "request": "When a new Google Form response is submitted, check if the email domain is a business email (not gmail.com or yahoo.com), and if it is, send a Slack message to #sales with the form data.",
        "output": '{"displayName":"New Response","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Response","settings":{"pieceName":"@activepieces/piece-google-forms","pieceVersion":"~0.0.1","triggerName":"new_response","input":{},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Business Email Filter","settings":{"pieceName":"@activepieces/piece-codemash","pieceVersion":"~0.0.1","actionName":"run_codemash","input":{"code":"function isBusinessEmail(email) {\\n  const allowedDomains = [\'yahoo.com\', \'gmail.com\', \'outlook.com\', \'hotmail.com\'];\\n  const domain = email.split(\'@\')[1];\\n  return !allowedDomains.includes(domain);\\n}\\n\\nmodule.exports = isBusinessEmail;\\n","inputUiInfo":{"customizedInputs":{}}},"propertySettings":{}},"nextAction":{"name":"step_2","type":"ROUTER","valid":true,"displayName":"Router","settings":{"executionType":"EXECUTE_FIRST_MATCH","branches":[{"branchType":"CONDITION","branchName":"condition_true","conditions":[[{"firstValue":"{{trigger.values.email}}","operator":"TEXT_DOES_NOT_CONTAIN","secondValue":"yahoo.com"},{"firstValue":"{{trigger.values.email}}","operator":"TEXT_DOES_NOT_CONTAIN","secondValue":"gmail.com"},{"firstValue":"{{trigger.values.email}}","operator":"TEXT_DOES_NOT_CONTAIN","secondValue":"outlook.com"},{"firstValue":"{{trigger.values.email}}","operator":"TEXT_DOES_NOT_CONTAIN","secondValue":"hotmail.com"}]]},{"branchType":"FALLBACK","branchName":"condition_false"}],"propertySettings":{}},"children":[{"name":"step_3","type":"PIECE","valid":true,"displayName":"send_channel_message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from send_channel_message"},"propertySettings":{}}},{"name":"step_4","type":"PIECE","valid":true,"displayName":"send_channel_message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from send_channel_message"},"propertySettings":{}}}]}}},"schemaVersion":null}'
    },
    {
        "id": 5,
        "name": "Email Processing",
        "request": "When a new email arrives in Gmail with subject containing 'Invoice', extract the sender email and invoice amount, then create a row in Google Sheets 'Invoices' with the sender email, amount, and current date.",
        "output": '{"displayName":"New Email Arrival","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Email Arrival","settings":{"pieceName":"@activepieces/piece-gmail","pieceVersion":"~0.4.0","triggerName":"new_email_received","input":{"label":"No label","category":"primary"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Extract Data","settings":{"pieceName":"@activepieces/piece-data-mapper","pieceVersion":"~0.0.1","actionName":"advanced_mapping","input":{"mapping":{"email":"{{trigger.message.from[0].text}}","amount":"{{trigger.message.subject}}","sender":"{{trigger.message.date}}"}},"propertySettings":{}},"nextAction":{"name":"step_2","type":"PIECE","valid":true,"displayName":"Insert Row","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{step_1}}"},"propertySettings":{}}}}},"schemaVersion":null}'
    }
]

def analyze_output(output_data):
    """Analyze a single output."""
    issues = []
    warnings = []
    positives = []
    fixable = []
    
    try:
        flow = json.loads(output_data["output"])
    except json.JSONDecodeError as e:
        return {
            "issues": [f"Invalid JSON: {e}"],
            "warnings": [],
            "positives": [],
            "fixable": [],
            "schema_compatible": False
        }
    
    # Check root level
    if "displayName" in flow:
        positives.append("Has 'displayName' ✅")
    else:
        issues.append("Missing 'displayName'")
    
    if flow.get("schemaVersion") is None:
        issues.append("schemaVersion is null (should be '10')")
        fixable.append("Set schemaVersion to '10'")
    elif flow.get("schemaVersion") == "10":
        positives.append("Has schemaVersion: '10' ✅")
    
    # Check trigger
    if "trigger" not in flow:
        issues.append("Missing 'trigger'")
        return {"issues": issues, "warnings": warnings, "positives": positives, 
                "fixable": fixable, "schema_compatible": False}
    
    trigger = flow["trigger"]
    
    # Check trigger type and name
    trigger_type = trigger.get("type")
    trigger_settings = trigger.get("settings", {})
    trigger_name = trigger_settings.get("triggerName", "")
    piece_name = trigger_settings.get("pieceName", "")
    
    # Check if correct trigger for request
    request_lower = output_data["request"].lower()
    
    if "schedule" in request_lower or "monday" in request_lower or "every" in request_lower:
        if "schedule" not in piece_name.lower():
            issues.append(f"Wrong trigger: Uses {piece_name} instead of @activepieces/piece-schedule")
        if trigger_name not in ["every_day", "every_week", "every_month"]:
            issues.append(f"Wrong trigger name: '{trigger_name}' (should be 'every_week' for Monday)")
    
    if "google sheets" in request_lower and "new row" in request_lower:
        if trigger_name != "new_row":
            issues.append(f"Wrong trigger name: '{trigger_name}' (should be 'new_row')")
    
    if "webhook" in request_lower:
        if trigger_name not in ["webhook", "catch_webhook", "catch_request"]:
            warnings.append(f"Trigger name '{trigger_name}' might not be standard")
    
    if "gmail" in request_lower or "email" in request_lower:
        if trigger_name not in ["new_email", "new_email_received"]:
            warnings.append(f"Trigger name '{trigger_name}' might not be standard")
    
    # Check actions
    def check_actions(action, path="trigger.nextAction", depth=0):
        if action is None or depth > 10:
            return
        
        action_type = action.get("type", "")
        action_settings = action.get("settings", {})
        action_name = action_settings.get("actionName", "")
        piece_name = action_settings.get("pieceName", "")
        
        # Check action type
        if action_type == "CONDITION":
            warnings.append(f"{path} uses 'CONDITION' type (should be 'ROUTER')")
            fixable.append(f"Change {path}.type from 'CONDITION' to 'ROUTER'")
        
        # Check action names
        wrong_names = {
            "compose_and_send_email": "send_email",
            "summarize_text": "ask_ai" or "askAi",
            "run_codemash": "CODE type (not piece)",
            "advanced_mapping": "CODE type (not piece)"
        }
        
        if action_name in wrong_names:
            issues.append(f"{path} uses wrong action name: '{action_name}' (should be '{wrong_names[action_name]}')")
        
        # Check piece names
        if "codemash" in piece_name.lower():
            warnings.append(f"{path} uses piece-codemash (should use CODE type instead)")
        if "data-mapper" in piece_name.lower():
            warnings.append(f"{path} uses piece-data-mapper (should use CODE type instead)")
        
        # Check for hardcoded text
        if "input" in action_settings:
            input_data = action_settings["input"]
            if isinstance(input_data, dict) and "text" in input_data:
                text = input_data["text"]
                if "Notification from" in text and "{{" not in text:
                    warnings.append(f"{path} has hardcoded text (doesn't use actual data)")
        
        # Recurse
        if "nextAction" in action:
            check_actions(action["nextAction"], f"{path}.nextAction", depth + 1)
        if "children" in action:
            for i, child in enumerate(action["children"]):
                if child:
                    check_actions(child, f"{path}.children[{i}]", depth + 1)
    
    if "nextAction" in trigger:
        check_actions(trigger["nextAction"])
    
    # Schema compatibility
    schema_compatible = len([i for i in issues if "Missing" in i or "Invalid" in i]) == 0
    
    return {
        "issues": issues,
        "warnings": warnings,
        "positives": positives,
        "fixable": fixable,
        "schema_compatible": schema_compatible
    }

def main():
    print("=" * 80)
    print("ANALYSIS OF FINE-TUNED MODEL OUTPUTS")
    print("=" * 80)
    print()
    
    compatible_count = 0
    
    for output_data in outputs:
        print(f"Output {output_data['id']}: {output_data['name']}")
        print("-" * 80)
        print(f"Request: {output_data['request']}")
        print()
        
        result = analyze_output(output_data)
        
        if result["positives"]:
            print("✅ Positives:")
            for pos in result["positives"]:
                print(f"   {pos}")
            print()
        
        if result["issues"]:
            print("❌ Issues:")
            for issue in result["issues"]:
                print(f"   - {issue}")
            print()
        
        if result["warnings"]:
            print("⚠️  Warnings:")
            for warning in result["warnings"]:
                print(f"   - {warning}")
            print()
        
        if result["fixable"]:
            print("🔧 Fixable:")
            for fix in result["fixable"]:
                print(f"   ✅ {fix}")
            print()
        
        print(f"Schema Compatible: {'✅ YES' if result['schema_compatible'] else '⚠️  PARTIAL'}")
        if result["schema_compatible"]:
            compatible_count += 1
        print()
        print("=" * 80)
        print()
    
    # Summary
    print("SUMMARY")
    print("=" * 80)
    print(f"Schema Compatible: {compatible_count}/{len(outputs)} ({compatible_count/len(outputs)*100:.0f}%)")
    print()
    print("Key Improvements:")
    print("✅ All outputs have 'displayName' (not 'name')")
    print("⚠️  All outputs have schemaVersion: null (should be '10')")
    print("✅ Most have correct structure")
    print()
    print("Common Issues:")
    print("1. schemaVersion is null (easy fix)")
    print("2. Some wrong action/trigger names")
    print("3. Some wrong piece types (should use CODE instead)")
    print("4. Hardcoded text (doesn't use actual data)")

if __name__ == "__main__":
    main()

