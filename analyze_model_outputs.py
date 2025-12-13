#!/usr/bin/env python3
"""Analyze Qwen Coder 7B model outputs for validity and issues."""

import json
import re

outputs = [
    {
        "name": "Output 1: Google Sheets → Slack",
        "json": '{"name":"Notify Sales of New Leads","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Notify Sales of New Leads"},"propertySettings":{}}}}',
        "request": "When a new row is added to the 'Leads' Google Sheet, send a Slack message to #sales with the lead name and email."
    },
    {
        "name": "Output 2: Webhook Conditional",
        "json": '{"name":"Webhook Validation","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook Trigger","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.0","triggerName":"catch_webhook","propertySettings":{}},"nextAction":{"name":"step_router","type":"ROUTER","valid":true,"displayName":"Check Email","settings":{"executionType":"EXECUTE_FIRST_MATCH","branches":[{"branchType":"CONDITION","branchName":"Email is Present","conditions":[[{"firstValue":"{{trigger.body.email}}","operator":"EXISTS"}]]},{"branchType":"FALLBACK","branchName":"Email is absent"}],"propertySettings":{}},"children":[{"name":"step_true","type":"PIECE","valid":true,"displayName":"Send Slack Alert","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#ops","text":"Notification from Send Slack Alert"},"propertySettings":{}}},{"name":"step_false","type":"PIECE","valid":true,"displayName":"Add to Google Sheet","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{trigger.body}}"},"propertySettings":{}}}}]}',
        "request": "When a webhook is received, if email is missing then send a Slack alert to #ops, else add the payload to a Google Sheet named 'Inbound'."
    },
    {
        "name": "Output 3: Schedule → Multi-step",
        "json": '{"name":"Daily Lead Summary","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Every Day at 9AM","settings":{"pieceName":"@activepieces/piece-schedule","pieceVersion":"~0.1.0","triggerName":"every_day","input":{"hour_of_the_day":9},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Get Yesterday\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_2","type":"PIECE","valid":true,"displayName":"Get Today\'s Rows","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","actionName":"get_rows","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_3","type":"CODE","valid":true,"displayName":"Build Summary","settings":{"input":{},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => {\\n const yesterday = inputs.yesterday || [];\\n const today = inputs.today || [];\\n\\n const newLeads = today.filter(t => !yesterday.find(y => y.id === t.id));\\n\\n const msg = `Yesterday: ${yesterday.length} lead(s)\\n Today: ${today.length} lead(s)\\n\\n New Leads:\\n- ${newLeads.map(n => n.name).join(\'\\n- \')}`;\\n\\n return { summary: msg };\\n};"},"packageJson":"{}"},"nextAction":{"name":"step_4","type":"PIECE","valid":true,"displayName":"Send Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"send_channel_message","input":{"channel":"#sales","text":"Notification from Send Slack Message":"{{step_3.output.summary}}"},"propertySettings":{}}}}}}}',
        "request": "Every day at 9am, read today's rows from Google Sheets 'Leads', summarize them, and post the summary to Slack #sales."
    },
    {
        "name": "Output 4: Explicit Steps",
        "json": '{"name":"New Lead Notification","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Lead Added","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.11.0","triggerName":"google_sheets_row_added","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Send Message To A Channel","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.9.0","actionName":"slack_send_message","input":{"channel":"#sales","text":"New lead: {{trigger.body.Name}} ({{trigger.body.Email}})"},"propertySettings":{}}}}',
        "request": "Create a flow using these steps: Trigger: google_sheets_row_added (sheet: Leads) Action1: slack_send_message (channel: #sales, message: \"New lead: {{row['Name']}} ({{row['Email']}})\")"
    },
    {
        "name": "Output 5: Gmail → Notion",
        "json": '{"name":"Create Notion page from new Gmail","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Email","settings":{"pieceName":"@activepieces/piece-gmail","pieceVersion":"~0.8.0","triggerName":"gmail_new_email_received","input":{"gmailAccountId":"__TODO_GMAIL_ACCOUNT_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Create Notion Page","settings":{"pieceName":"@activepieces/piece-notion","pieceVersion":"~0.3.0","actionName":"create_page","input":{},"propertySettings":{}}}}',
        "request": "When a new email arrives in Gmail with subject containing 'Demo', create a Notion page in database 'Sales Demo Requests' with title = sender name and body = email snippet."
    },
]

def analyze_output(output_info):
    """Analyze a single output."""
    issues = []
    warnings = []
    positives = []
    
    try:
        data = json.loads(output_info['json'])
    except json.JSONDecodeError as e:
        return {
            'valid_json': False,
            'error': str(e),
            'issues': ['Invalid JSON'],
            'warnings': [],
            'positives': []
        }
    
    # Check root level structure
    if 'name' in data and 'displayName' not in data:
        issues.append("❌ Uses 'name' instead of 'displayName' at root level")
    elif 'displayName' not in data:
        issues.append("❌ Missing 'displayName' at root level")
    else:
        positives.append("✅ Has 'displayName' at root level")
    
    if 'schemaVersion' not in data:
        issues.append("❌ Missing 'schemaVersion' at root level")
    else:
        positives.append("✅ Has 'schemaVersion'")
    
    # Check trigger structure
    if 'trigger' not in data:
        issues.append("❌ Missing 'trigger'")
        return {'valid_json': True, 'issues': issues, 'warnings': warnings, 'positives': positives}
    
    trigger = data['trigger']
    
    # Check trigger settings
    if 'settings' in trigger:
        settings = trigger['settings']
        
        if 'input' not in settings:
            issues.append("❌ Missing 'input' in trigger.settings (should be {} or have fields)")
        elif settings.get('input') == {}:
            positives.append("✅ Has 'input' in trigger.settings")
        
        if 'propertySettings' not in settings:
            issues.append("❌ Missing 'propertySettings' in trigger.settings")
        else:
            positives.append("✅ Has 'propertySettings'")
        
        if 'pieceVersion' not in settings:
            warnings.append("⚠️ Missing 'pieceVersion' in trigger.settings")
        else:
            positives.append("✅ Has 'pieceVersion'")
    
    # Check for ROUTER logic issues (Output 2)
    if output_info['name'] == 'Output 2: Webhook Conditional':
        if 'nextAction' in trigger and trigger['nextAction'].get('type') == 'ROUTER':
            router = trigger['nextAction']
            branches = router.get('settings', {}).get('branches', [])
            if len(branches) >= 2:
                condition_branch = branches[0]
                fallback_branch = branches[1]
                
                # Check if logic is reversed
                if 'Email is Present' in condition_branch.get('branchName', ''):
                    issues.append("❌ LOGIC REVERSED: Condition checks if email EXISTS, but should check if MISSING")
                    issues.append("❌ Branch names are backwards (Email is Present should be Email Missing)")
                
                # Check children order
                children = router.get('children', [])
                if len(children) >= 2:
                    if 'Send Slack Alert' in children[0].get('displayName', ''):
                        issues.append("❌ Children order wrong: Slack alert (for missing email) should be in first branch, not second")
    
    # Check for syntax errors (Output 3)
    if output_info['name'] == 'Output 3: Schedule → Multi-step':
        if '"text":"Notification from Send Slack Message":"{{step_3.output.summary}}"' in output_info['json']:
            issues.append("❌ SYNTAX ERROR: Double quotes in text field - should be 'text': '{{step_3.output.summary}}'")
        
        if '"sampleData":{}' in output_info['json']:
            warnings.append("⚠️ Has 'sampleData' field (should be removed by post-processor)")
    
    # Check for wrong action/trigger names (Output 4)
    if output_info['name'] == 'Output 4: Explicit Steps':
        if 'google_sheets_row_added' in output_info['json']:
            issues.append("❌ Wrong trigger name: 'google_sheets_row_added' should be 'new_row'")
        
        if 'slack_send_message' in output_info['json']:
            issues.append("❌ Wrong action name: 'slack_send_message' should be 'send_channel_message'")
        
        if 'trigger.body.Name' in output_info['json']:
            issues.append("❌ Wrong data access: '{{trigger.body.Name}}' should be '{{trigger.values.Name}}' for Google Sheets")
    
    # Check for missing filters/conditions (Output 5)
    if output_info['name'] == 'Output 5: Gmail → Notion':
        if 'subject containing "Demo"' in output_info['request'] and 'Demo' not in output_info['json']:
            warnings.append("⚠️ Missing filter for email subject containing 'Demo'")
        
        if 'input":{}' in output_info['json'] and 'title' not in output_info['json']:
            warnings.append("⚠️ Notion page input is empty - should have title and body fields")
    
    # Check if request requirements are met
    if 'lead name and email' in output_info['request'].lower():
        if '{{trigger.values' not in output_info['json'] and '{{trigger.body' not in output_info['json']:
            warnings.append("⚠️ Text doesn't use actual lead data from trigger")
    
    return {
        'valid_json': True,
        'issues': issues,
        'warnings': warnings,
        'positives': positives
    }

print("=" * 70)
print("QWEN CODER 7B MODEL OUTPUT ANALYSIS")
print("=" * 70)
print()

overall_issues = []
overall_warnings = []
overall_positives = []

for output_info in outputs:
    print(f"\n{output_info['name']}")
    print("-" * 70)
    print(f"Request: {output_info['request'][:80]}...")
    print()
    
    result = analyze_output(output_info)
    
    if not result['valid_json']:
        print(f"❌ INVALID JSON: {result.get('error', 'Unknown error')}")
        overall_issues.append(f"{output_info['name']}: Invalid JSON")
        continue
    
    if result['positives']:
        print("✅ Positives:")
        for pos in result['positives']:
            print(f"   {pos}")
            overall_positives.append(pos)
    
    if result['issues']:
        print("\n❌ Critical Issues:")
        for issue in result['issues']:
            print(f"   {issue}")
            overall_issues.append(f"{output_info['name']}: {issue}")
    
    if result['warnings']:
        print("\n⚠️ Warnings:")
        for warn in result['warnings']:
            print(f"   {warn}")
            overall_warnings.append(f"{output_info['name']}: {warn}")

print("\n" + "=" * 70)
print("OVERALL ASSESSMENT")
print("=" * 70)
print()
print(f"✅ Positives: {len(overall_positives)}")
print(f"❌ Critical Issues: {len(overall_issues)}")
print(f"⚠️ Warnings: {len(overall_warnings)}")
print()

# Common issues
common_issues = {}
for issue in overall_issues:
    key = issue.split(': ')[-1] if ': ' in issue else issue
    common_issues[key] = common_issues.get(key, 0) + 1

print("Most Common Issues:")
for issue, count in sorted(common_issues.items(), key=lambda x: x[1], reverse=True)[:5]:
    print(f"  - {issue}: {count}x")

print("\n" + "=" * 70)
print("RECOMMENDATIONS")
print("=" * 70)
print()
print("1. Schema Issues:")
print("   - Model consistently uses 'name' instead of 'displayName'")
print("   - Model consistently missing 'schemaVersion'")
print("   - Some missing 'input' fields in triggers")
print()
print("2. Logic Issues:")
print("   - Conditional logic is REVERSED (Output 2)")
print("   - Wrong action/trigger names (Output 4)")
print("   - Wrong data access patterns (trigger.body vs trigger.values)")
print()
print("3. Post-Processor Can Fix:")
print("   ✅ Add missing 'schemaVersion'")
print("   ✅ Add missing 'propertySettings'")
print("   ✅ Remove 'sampleData'")
print("   ❌ CANNOT fix: 'name' → 'displayName' (needs training)")
print("   ❌ CANNOT fix: Reversed logic (needs training)")
print("   ❌ CANNOT fix: Wrong action names (needs training)")
print()
print("4. Will Adding Your 10 Workflows Help?")
print("   ✅ YES - Real examples will help with:")
print("      - Correct action/trigger names")
print("      - Correct data access patterns")
print("      - Real-world input structures")
print("      - Proper conditional logic")
print("   ⚠️ BUT - Still need to fix 'name' vs 'displayName' issue")
print()

