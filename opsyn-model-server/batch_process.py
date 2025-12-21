#!/usr/bin/env python3
"""
Batch process all model outputs.
Run with: python3 batch_process.py
"""
import json
import re
from pathlib import Path
from postprocessor_v2 import postprocess

OUTPUT_DIR = Path(__file__).parent / "generated_templates"
OUTPUT_DIR.mkdir(exist_ok=True)

def fix_json(raw: str) -> str:
    """Fix common JSON issues before parsing."""
    # Remove markdown code blocks
    if "```json" in raw:
        m = re.search(r'```json\s*(.*?)\s*```', raw, re.DOTALL)
        if m: raw = m.group(1)
    elif "```" in raw:
        m = re.search(r'```\s*(.*?)\s*```', raw, re.DOTALL)
        if m: raw = m.group(1)
    
    # Fix piece names
    raw = re.sub(r'activepieces-piee-', '@activepieces/piece-', raw)
    raw = re.sub(r'activepieces-piece-', '@activepieces/piece-', raw)
    raw = re.sub(r'activepieces-official[/-]', '@activepieces/piece-', raw)
    raw = re.sub(r'"activepieces/', '"@activepieces/piece-', raw)
    
    return raw.strip()

def process_single(raw: str, test_num: int) -> dict:
    """Process a single output."""
    fixed = fix_json(raw)
    template = postprocess(fixed)
    
    # Save
    filename = OUTPUT_DIR / f"test_{test_num:02d}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(template, f, indent=2, ensure_ascii=False)
    
    return {
        "file": str(filename),
        "pieces": template.get("pieces", []),
        "trigger": template.get("template", {}).get("trigger", {}).get("settings", {}).get("triggerName", "N/A")
    }

# ============================================================================
# RAW OUTPUTS - Each test is a separate string in this list
# ============================================================================
RAW_OUTPUTS = [
    # TEST 1
    r'{"displayName": "Google Sheets Row to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New Worksheet", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_worksheet", "input": {"auth": "{{connections[\"google_sheets\"]}}", "spreadsheet_id": "{{configs[\"spreadsheet_id\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"notifications_channel\"]}}", "text": "New Row Added"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 2
    r'{"displayName": "Gmail to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New Email", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "gmail_new_email_received", "input": {}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Notification", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"notifications_channel\"]}}", "text": "New Email from {{steps.trigger.from}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 3
    r'{"displayName": "Daily Slack Reminder", "trigger": {"name": "trigger", "valid": true, "displayName": "Every Day at 9AM", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "cron_expression", "input": {"cronExpression": "0 9 * * *"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Reminder", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.13.1", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"reminder_channel\"]}}", "text": "Daily Reminder - Time to check in!"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 4
    r'{"displayName": "Webhook to Sheets", "trigger": {"name": "trigger", "valid": true, "displayName": "Catch Webhook", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-webhook", "pieceVersion": "~0.1.25", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "catch_webhook", "input": {}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Log Data", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-google-sheets", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "insert_row", "input": {"auth": "{{connections[\"google_sheets\"]}}", "spreadsheet_id": "{{configs[\"log_spreadsheet_id\"]}}", "sheet_id": 0, "values": {"Time": "{{now()}}", "Body": "{{trigger.body}}"}}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 5
    r'{"displayName": "GitHub Issue to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New GitHub Issue", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-github", "pieceVersion": "~0.5.13", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "issues", "input": {"auth": "{{connections[\"github\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Slack Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"github_issues_channel\"]}}", "text": "New GitHub Issue: {{steps.trigger.title}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 6
    r'{"displayName": "Google Drive File to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New Google Drive File", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-google-drive", "pieceVersion": "~0.3.12", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_file", "input": {"auth": "{{connections[\"google_drive\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Slack Notification", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.15.1", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"files_channel\"]}}", "text": "New file uploaded: {{steps.trigger.name}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 7
    r'{"displayName": "Hourly Email Summary", "trigger": {"name": "trigger", "valid": true, "displayName": "Every Hour", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "triggerName": "cron_expression", "input": {"cronExpression": "0 * * * *"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Email", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "actionName": "send_email", "input": {"auth": "{{connections[\"gmail\"]}}", "to": ["{{configs[\"summary_email\"]}}"], "subject": "Daily Summary Report", "body": "Here is your daily summary report."}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 8
    r'{"displayName": "Stripe Payment to Slack Alert", "trigger": {"name": "trigger", "valid": true, "displayName": "Stripe Payment Received", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-stripe", "pieceVersion": "~0.3.12", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_payment", "input": {"auth": "{{connections[\"stripe\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Slack Alert", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.15.1", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "#payments", "text": "New Payment received"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 9
    r'{"displayName": "Trello Card to Discord", "trigger": {"name": "trigger", "valid": true, "displayName": "New Trello Card", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-trello", "pieceVersion": "~0.3.15", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_card", "input": {"auth": "{{connections[\"trello\"]}}", "board_id": "{{configs[\"trello_board_id\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-discord", "pieceVersion": "~0.4.29", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_message_webhook", "input": {"webhook_url": "{{connections[\"discord_webhook\"]}}", "content": "New Trello Card: {{steps.trigger.name}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 10
    r'{"displayName": "Airtable Record to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New Airtable Record", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-airtable", "pieceVersion": "~0.5.13", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_record", "input": {"auth": "{{connections[\"airtable\"]}}", "base_id": "{{configs[\"airtable_base_id\"]}}", "table_id": "{{configs[\"airtable_table_id\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Slack Notification", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.10.16", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "#general", "text": "New Airtable Record: {{steps.trigger.id}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 11
    r'{"displayName": "Weekly Reminder", "trigger": {"name": "trigger", "valid": true, "displayName": "Every Monday", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "triggerName": "cron_expression", "input": {"cronExpression": "0 8 * * 1"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.9.6", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"reminder_channel\"]}}", "text": "Weekly Reminder - Review your tasks"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 12
    r'{"displayName": "Typeform Submission to Email", "trigger": {"name": "trigger", "valid": true, "displayName": "New Submission", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-typeform", "pieceVersion": "~0.3.14", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new_submission", "input": {"auth": "{{connections[\"typeform\"]}}", "form_id": "{{configs[\"typeform_form_id\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Confirmation Email", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-gmail", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_email", "input": {"auth": "{{connections[\"gmail\"]}}", "to": ["{{steps.trigger.answers.email}}"], "subject": "Thank You!", "body": "Thanks for your submission!"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 13
    r'{"displayName": "HubSpot Contact to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "New COS Blog Article", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-hubspot", "pieceVersion": "~0.5.13", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "new-blog-article", "input": {"auth": "{{connections[\"hubspot\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Slack Notification", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"contacts_channel\"]}}", "text": "New Contact from HubSpot"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 14
    r'{"displayName": "GitHub PR to Slack", "trigger": {"name": "trigger", "valid": true, "displayName": "Pull Request", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-github", "pieceVersion": "~0.5.13", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "triggerName": "pull_request", "input": {"auth": "{{connections[\"github\"]}}"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "pieceVersion": "~0.9.6", "pieceType": "OFFICIAL", "packageType": "REGISTRY", "actionName": "send_channel_message", "input": {"auth": "{{connections[\"slack\"]}}", "channel": "{{configs[\"pr_channel\"]}}", "text": "New PR: {{steps.trigger.title}}"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
    
    # TEST 15
    r'{"displayName": "Daily Summary to Discord", "trigger": {"name": "trigger", "valid": true, "displayName": "Every Day at 6PM", "type": "PIECE_TRIGGER", "settings": {"pieceName": "@activepieces/piece-schedule", "pieceVersion": "~0.1.25", "triggerName": "cron_expression", "input": {"cronExpression": "0 18 * * *"}, "inputUiInfo": {}}, "nextAction": {"name": "step_1", "valid": true, "displayName": "Send Message", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-discord", "pieceVersion": "~0.3.7", "actionName": "send_message_webhook", "input": {"webhook_url": "{{connections[\"discord\"]}}", "content": "Daily Summary - Good evening!"}, "inputUiInfo": {}}}}, "schemaVersion": "1"}',
]

def main():
    print(f"Found {len(RAW_OUTPUTS)} tests to process\n")
    
    passed = 0
    failed = 0
    
    for i, raw in enumerate(RAW_OUTPUTS, 1):
        print(f"--- TEST {i} ---")
        try:
            result = process_single(raw, i)
            print(f"✅ PASSED")
            print(f"   Trigger: {result['trigger']}")
            print(f"   Pieces: {result['pieces']}")
            print(f"   File: {result['file']}")
            passed += 1
        except Exception as e:
            print(f"❌ FAILED: {e}")
            failed += 1
        print()
    
    print("="*70)
    print(f"SUMMARY: {passed} passed, {failed} failed out of {len(RAW_OUTPUTS)}")
    print(f"Templates saved to: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()

