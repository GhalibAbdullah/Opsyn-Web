#!/usr/bin/env python3
"""
Test the post-processor on all 20 fine-tuned model outputs.
"""
import json
from typing import Dict, List
from postprocessor_v2 import postprocess

# All 20 test outputs from fine-tuned model
TEST_OUTPUTS = [
    # TEST 1
    {"displayName": "Google Sheets Row to Slack", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Worksheet", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {"spreadsheet_id": None}, "propertySettings": {}, "triggerName": "googleSheets_newWorksheet"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Send Channel Message (Text)", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "input": {"auth": "{{connections['slack']}}", "channel": "C0A2UQZJF3R", "text": "✅ New Row Added"}, "propertySettings": {}, "actionName": "send_channel_message"}}}},
    
    # TEST 2
    {"displayName": "Google Sheets Row Processor", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Worksheet", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {"spreadsheet_id": None}, "propertySettings": {}, "triggerName": "googleSheets_newWorksheet"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Send Slack Notification", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.19", "input": {"auth": "{{connections['slack']}}", "channel": "#general", "text": "✅ New row processed"}, "propertySettings": {}, "actionName": "send_channel_message"}, "nextAction": {"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Update Row Status", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {"auth": "{{connections['google_sheets']}}", "spreadsheet_id": "{{trigger.spreadsheetId}}", "sheet_id": 0, "row_number": "{{trigger.rowNumber}}", "values": {"status": "processed"}}, "propertySettings": {}, "actionName": "update_row"}}}}},
    
    # TEST 3
    {"displayName": "Lead Router by Score", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Catch Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Send Slack", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "High score lead!"}, "propertySettings": {}, "actionName": "send_channel_message"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Insert Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "input": {}, "propertySettings": {}, "actionName": "insert_row"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 4
    {"displayName": "Daily Pending Reminder", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Every Day at 9AM", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "input": {"timezone": "UTC", "hour_of_the_day": 9}, "propertySettings": {}, "triggerName": "every_day"}, "nextAction": {"name": "step_1", "type": "LOOP_ON_ITEMS", "valid": True, "displayName": "Loop on Rows", "settings": {"items": "{{trigger.body.rows}}"}, "firstLoopAction": {"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Send Email", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "send_email"}}}}},
    
    # TEST 5
    {"displayName": "GitHub Issue to Slack and Todoist", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Issue", "settings": {"pieceName": "@activepieces/piece-github", "pieceVersion": "~0.5.23", "input": {"auth": "{{connections['github']}}"}, "propertySettings": {}, "triggerName": "new_issue"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Send Message", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.19", "input": {"text": "New Issue!"}, "propertySettings": {}, "actionName": "send_channel_message"}, "nextAction": {"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Create Item", "settings": {"pieceName": "@activepieces/piece-todoist", "pieceVersion": "~0.4.8", "input": {"content": "{{steps.trigger.title}}"}, "propertySettings": {}, "actionName": "create_item"}}}}},
    
    # TEST 6
    {"displayName": "GitHub Issue Router by Label", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Issue", "settings": {"pieceName": "@activepieces/piece-github", "pieceVersion": "~0.5.23", "input": {"auth": "{{connections['github']}}"}, "propertySettings": {}, "triggerName": "new_issue"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Create Task", "settings": {"pieceName": "@activepieces/piece-todoist", "pieceVersion": "~0.4.3", "input": {"priority": 1}, "propertySettings": {}, "actionName": "create_task"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Create Database Item", "settings": {"pieceName": "@activepieces/piece-notion", "pieceVersion": "~0.6.8", "input": {}, "propertySettings": {}, "actionName": "create_database_item"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Condition", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 7
    {"displayName": "Google Drive PDF to S3 and Slack", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New File", "settings": {"pieceName": "@activepieces/piece-google-drive", "pieceVersion": "~0.5.2", "input": {"auth": "{{connections['google_drive']}}"}, "propertySettings": {}, "triggerName": "new_file"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Upload to S3", "settings": {"pieceName": "@activepieces/piece-amazon-s3", "pieceVersion": "~0.4.7", "input": {}, "propertySettings": {}, "actionName": "upload-file"}, "nextAction": {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Send Slack", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "input": {"text": "PDF uploaded"}, "propertySettings": {}, "actionName": "send_channel_message"}}}, None], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 8
    {"displayName": "Gmail Invoice Attachment Router", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Email", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "input": {"label": None}, "propertySettings": {}, "triggerName": "gmail_new_email_received"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Send Auto Reply", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "send_email"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Upload File", "settings": {"pieceName": "@activepieces/piece-google-drive", "pieceVersion": "~0.4.3", "input": {}, "propertySettings": {}, "actionName": "upload_gdrive_file"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 9 - Has firstAction instead of trigger
    {"displayName": "Order Validation and Logging", "valid": True, "schemaVersion": "1", "firstAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Receive Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {"authType": "none"}, "propertySettings": {}}, "nextAction": {"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Validate Order", "settings": {"pieceName": "@activepieces/piece-http", "actionName": "send_request", "input": {}}, "propertySettings": {}}}},
    
    # TEST 10
    {"displayName": "Order Validation Webhook", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Catch Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "CODE", "valid": True, "displayName": "Validate Order", "settings": {"sourceCode": {"packageJson": "{}", "code": "export const code = async (inputs) => { return inputs; };"}, "input": {}}, "nextAction": {"name": "step_2", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Send Slack", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "Validation Failed"}, "propertySettings": {}, "actionName": "send_channel_message"}}, {"name": "step_4", "type": "PIECE", "valid": True, "displayName": "Create Notion Item", "settings": {"pieceName": "@activepieces/piece-notion", "input": {}, "propertySettings": {}, "actionName": "create_database_item"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}}},
    
    # TEST 11
    {"displayName": "Hourly Overdue Task Reminder", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Every Hour", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "input": {"timezone": "UTC"}, "propertySettings": {}, "triggerName": "every_hour"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "HTTP Request", "settings": {"pieceName": "@activepieces/piece-http", "pieceVersion": "~0.9.5", "input": {}, "propertySettings": {}, "actionName": "send_request"}, "nextAction": {"name": "step_2", "type": "LOOP_ON_ITEMS", "valid": True, "displayName": "Loop on Tasks", "settings": {"items": "{{step_1.body}}"}, "firstLoopAction": {"name": "step_3", "type": "CODE", "valid": True, "displayName": "Code", "settings": {"sourceCode": {"code": "export const code = async (inputs) => { return { isOverdue: true }; };"}, "input": {}}, "nextAction": {"name": "step_4", "type": "CONDITION", "valid": True, "displayName": "Check Overdue", "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION_BRANCH", "branchName": "Is Overdue", "conditions": [[{"firstValue": "{{step_3.isOverdue}}", "operator": "BOOLEAN_IS_TRUE"}]]}, {"branchType": "FALLBACK_BRANCH", "branchName": "Not Overdue"}]}, "children": [{"name": "step_5", "type": "PIECE", "valid": True, "displayName": "Slack", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "input": {"text": "Overdue!"}, "propertySettings": {}, "actionName": "send_channel_message"}}, None]}}}}}},
    
    # TEST 12
    {"displayName": "Incident Router by Severity", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Catch Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Slack Critical", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "CRITICAL"}, "propertySettings": {}, "actionName": "send_channel_message"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "PagerDuty", "settings": {"pieceName": "@activepieces/piece-pagerduty", "input": {}, "propertySettings": {}, "actionName": "create_incidents_alert"}}, {"name": "step_4", "type": "PIECE", "valid": True, "displayName": "Insert Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "input": {}, "propertySettings": {}, "actionName": "insert_row"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "CONDITION", "branchName": "Branch 2", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 13
    {"displayName": "HubSpot Contact Sync", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Blog Article", "settings": {"pieceName": "@activepieces/piece-hubspot", "pieceVersion": "~0.5.23", "input": {}, "propertySettings": {}, "triggerName": "new-blog-article"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Check Email", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "search_google_sheets"}, "nextAction": {"name": "step_2", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Update Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "update_row"}}, {"name": "step_4", "type": "PIECE", "valid": True, "displayName": "Insert Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "insert_row"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Email Found", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Email Not Found"}]}}}}},
    
    # TEST 14
    {"displayName": "Support Ticket Router", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Catch Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Slack Urgent", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "HIGH PRIORITY"}, "propertySettings": {}, "actionName": "send_channel_message"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Slack General", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "New Ticket"}, "propertySettings": {}, "actionName": "send_channel_message"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 15
    {"displayName": "Weekly Todoist Archiver", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Every Sunday", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "input": {"dayOfWeek": 7}, "propertySettings": {}, "triggerName": "cron_expression"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "Get Completed Tasks", "settings": {"pieceName": "@activepieces/piece-todoist", "pieceVersion": "~0.3.0", "input": {}, "propertySettings": {}, "actionName": "get-completed-tasks"}, "nextAction": {"name": "step_2", "type": "LOOP_ON_ITEMS", "valid": True, "displayName": "Loop on Tasks", "settings": {"items": "{{step_1.tasks}}"}, "firstLoopAction": {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Insert Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.12.4", "input": {}, "propertySettings": {}, "actionName": "insert_row"}}}}}},
    
    # TEST 16
    {"displayName": "Google Sheets Enricher", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Worksheet", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {"spreadsheet_id": None}, "propertySettings": {}, "triggerName": "googleSheets_newWorksheet"}, "nextAction": {"name": "step_1", "type": "PIECE", "valid": True, "displayName": "HTTP API", "settings": {"pieceName": "@activepieces/piece-http", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "send_request"}, "nextAction": {"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Update Row", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "update_google_sheets_row"}}}}},
    
    # TEST 17
    {"displayName": "Signup Webhook Router", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Catch Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Send Email", "settings": {"pieceName": "@activepieces/piece-gmail", "input": {"receiver": "{{steps.trigger.body.email}}", "subject": "Welcome!", "body": "Hi!"}, "propertySettings": {}, "actionName": "send_email"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Slack Notify", "settings": {"pieceName": "@activepieces/piece-slack", "input": {"text": "Missing email"}, "propertySettings": {}, "actionName": "send_channel_message"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}},
    
    # TEST 18
    {"displayName": "Expense Report Router", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "Webhook", "settings": {"pieceName": "@activepieces/piece-webhook", "pieceVersion": "~0.1.25", "input": {}, "propertySettings": {}, "triggerName": "catch_webhook"}, "nextAction": {"name": "step_1", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_2", "type": "PIECE", "valid": True, "displayName": "Slack Approval", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.19", "input": {"text": "Expense > $1000"}, "propertySettings": {}, "actionName": "send_channel_message"}}, {"name": "step_3", "type": "PIECE", "valid": True, "displayName": "Log to Sheets", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.13.1", "input": {}, "propertySettings": {}, "actionName": "insert_row"}}, {"name": "step_4", "type": "CODE", "valid": True, "displayName": "Debug Code", "settings": {"sourceCode": {"code": "export const code = async (inputs) => { return inputs; };"}, "input": {}}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION_BASED", "branchName": "Condition Branch", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise Branch"}]}}}},
    
    # TEST 19 (skip - malformed)
    None,
    
    # TEST 20
    {"displayName": "Google Sheets Lead Follow-Up", "valid": True, "schemaVersion": "1", "trigger": {"name": "trigger", "type": "PIECE_TRIGGER", "valid": True, "displayName": "New Worksheet", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "input": {"spreadsheet_id": None}, "propertySettings": {}, "triggerName": "googleSheets_newWorksheet"}, "nextAction": {"name": "step_1", "type": "CODE", "valid": True, "displayName": "Code", "settings": {"sourceCode": {"packageJson": "{}", "code": "export const code = async (inputs) => { return inputs; };"}, "input": {}}, "nextAction": {"name": "step_2", "type": "TIMER", "valid": True, "displayName": "Timer", "settings": {"duration": 3, "unit": "DAYS"}, "nextAction": {"name": "step_3", "type": "ROUTER", "valid": True, "displayName": "Router", "children": [{"name": "step_4", "type": "PIECE", "valid": True, "displayName": "Send Email", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "send_email"}}, {"name": "step_5", "type": "PIECE", "valid": True, "displayName": "Slack Notify", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.9.6", "input": {}, "propertySettings": {}, "actionName": "send_channel_message"}}], "settings": {"executionType": "EXECUTE_FIRST_MATCH", "branches": [{"branchType": "CONDITION", "branchName": "Branch 1", "conditions": [[{"firstValue": "{{true}}", "operator": "EXISTS"}]]}, {"branchType": "FALLBACK", "branchName": "Otherwise"}]}}}}}},
]


def verify_workflow(result: Dict, test_num: int) -> List[str]:
    """Verify a processed workflow has required fields."""
    errors = []
    
    if not result:
        errors.append("Result is None")
        return errors
    
    # Check top-level
    if "template" not in result:
        errors.append("Missing 'template'")
        return errors
    
    if "pieces" not in result:
        errors.append("Missing 'pieces' list")
    
    template = result["template"]
    
    if "trigger" not in template:
        errors.append("Missing 'trigger' in template")
        return errors
    
    trigger = template["trigger"]
    
    # Check trigger
    if trigger.get("type") != "PIECE_TRIGGER":
        errors.append(f"Trigger type is '{trigger.get('type')}', expected 'PIECE_TRIGGER'")
    
    settings = trigger.get("settings", {})
    if not settings.get("pieceName"):
        errors.append("Trigger missing pieceName")
    if not settings.get("triggerName"):
        errors.append("Trigger missing triggerName")
    if not settings.get("pieceVersion"):
        errors.append("Trigger missing pieceVersion")
    
    # Check valid field
    if not trigger.get("valid"):
        errors.append("Trigger missing 'valid: true'")
    
    return errors


def main():
    print("=" * 70)
    print("POST-PROCESSOR V2 - TESTING ALL 20 OUTPUTS")
    print("=" * 70)
    
    passed = 0
    failed = 0
    skipped = 0
    
    for i, test_output in enumerate(TEST_OUTPUTS, 1):
        print(f"\n--- TEST {i} ---")
        
        if test_output is None:
            print("⏭️  SKIPPED (malformed)")
            skipped += 1
            continue
        
        # TEST 9 now handled by postprocessor (firstAction → trigger conversion)
        
        try:
            result = postprocess({"output": test_output})
            errors = verify_workflow(result, i)
            
            if errors:
                print(f"❌ FAILED: {errors}")
                failed += 1
            else:
                template = result["template"]
                trigger = template["trigger"]
                trigger_name = trigger["settings"]["triggerName"]
                pieces = result["pieces"]
                
                # Get first action name if exists
                action_name = "N/A"
                next_action = trigger.get("nextAction")
                if next_action:
                    if next_action.get("type") == "PIECE":
                        action_name = next_action.get("settings", {}).get("actionName", "N/A")
                    elif next_action.get("type") in ["ROUTER", "LOOP_ON_ITEMS", "CODE"]:
                        action_name = f"[{next_action.get('type')}]"
                
                print(f"✅ PASSED")
                print(f"   triggerName: {trigger_name}")
                print(f"   firstAction: {action_name}")
                print(f"   pieces: {pieces}")
                passed += 1
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
            failed += 1
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  PASSED:  {passed}")
    print(f"  FAILED:  {failed}")
    print(f"  SKIPPED: {skipped}")
    print(f"  TOTAL:   {passed + failed + skipped}")
    print(f"  SUCCESS RATE: {passed}/{passed+failed} ({100*passed/(passed+failed):.1f}%)")


if __name__ == "__main__":
    main()
