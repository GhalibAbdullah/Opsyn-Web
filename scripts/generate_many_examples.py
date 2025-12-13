#!/usr/bin/env python3
"""
Generate 100+ diverse training examples for Activepieces flow generation.
Covers: ROUTER conditionals, multi-step workflows, various pieces, different patterns.
"""

import json
import random

# Piece versions (approximate, commonly used)
PIECE_VERSIONS = {
    'webhook': '~1.0.0',
    'slack': '~0.9.0',
    'gmail': '~0.8.0',
    'google-sheets': '~0.11.0',
    'hubspot': '~0.5.0',
    'notion': '~0.3.0',
    'airtable': '~0.2.0',
    'discord': '~0.4.0',
    'openai': '~0.5.0',
    'text-ai': '~0.1.0',
    'http': '~0.7.0',
    'schedule': '~0.1.5',
    'google-drive': '~0.5.0',
    'stripe': '~0.6.0',
    'shopify': '~0.4.0',
    'zapier': '~0.3.0',
}

# Conditional operators
OPERATORS = {
    'number': ['NUMBER_IS_GREATER_THAN', 'NUMBER_IS_LESS_THAN', 'NUMBER_IS_EQUAL_TO'],
    'text': ['TEXT_CONTAINS', 'TEXT_DOES_NOT_CONTAIN', 'TEXT_IS_EXACTLY'],
    'exists': ['EXISTS', 'DOES_NOT_EXIST'],
    'boolean': ['BOOLEAN_IS_TRUE', 'BOOLEAN_IS_FALSE'],
}

def generate_webhook_conditional_examples():
    """Generate webhook-based conditional examples."""
    examples = []
    
    patterns = [
        {
            'instruction': 'When a webhook is received, if the amount is greater than 1000 then send email to finance@example.com, else post to Slack #general.',
            'condition': {'field': '{{trigger.body.amount}}', 'operator': 'NUMBER_IS_GREATER_THAN', 'value': '1000'},
            'true_action': {'type': 'gmail', 'action': 'send_email', 'channel': None},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#general'},
        },
        {
            'instruction': 'When a webhook is received, if status equals "error" then send Slack alert to #alerts, else add to Google Sheets.',
            'condition': {'field': '{{trigger.body.status}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'error'},
            'true_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#alerts'},
            'false_action': {'type': 'google-sheets', 'action': 'insert_row', 'channel': None},
        },
        {
            'instruction': 'When a webhook is received, if email field is missing then send Slack notification to #ops, else create HubSpot contact.',
            'condition': {'field': '{{trigger.body.email}}', 'operator': 'DOES_NOT_EXIST', 'value': None},
            'true_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#ops'},
            'false_action': {'type': 'hubspot', 'action': 'create_contact', 'channel': None},
        },
        {
            'instruction': 'When a webhook is received, if priority is "high" then send email, else post to Slack #low-priority.',
            'condition': {'field': '{{trigger.body.priority}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'high'},
            'true_action': {'type': 'gmail', 'action': 'send_email', 'channel': None},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#low-priority'},
        },
    ]
    
    for pattern in patterns:
        output = build_router_flow(
            trigger_type='webhook',
            condition=pattern['condition'],
            true_action=pattern['true_action'],
            false_action=pattern['false_action'],
        )
        examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    return examples

def generate_sheets_conditional_examples():
    """Generate Google Sheets-based conditional examples."""
    examples = []
    
    patterns = [
        {
            'instruction': 'When a new row is added in Google Sheets, if the score is greater than 90 then send email to sales@example.com, else post to Slack #leads.',
            'condition': {'field': '{{trigger.values.score}}', 'operator': 'NUMBER_IS_GREATER_THAN', 'value': '90'},
            'true_action': {'type': 'gmail', 'action': 'send_email', 'channel': None},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#leads'},
        },
        {
            'instruction': 'When a new row is added in Google Sheets, if status equals "approved" then create HubSpot contact, else send Slack notification to #pending.',
            'condition': {'field': '{{trigger.values.status}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'approved'},
            'true_action': {'type': 'hubspot', 'action': 'create_contact', 'channel': None},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#pending'},
        },
        {
            'instruction': 'When a new row is added in Google Sheets, if amount is less than 100 then send email alert, else add to Airtable.',
            'condition': {'field': '{{trigger.values.amount}}', 'operator': 'NUMBER_IS_LESS_THAN', 'value': '100'},
            'true_action': {'type': 'gmail', 'action': 'send_email', 'channel': None},
            'false_action': {'type': 'airtable', 'action': 'create_record', 'channel': None},
        },
    ]
    
    for pattern in patterns:
        output = build_router_flow(
            trigger_type='google-sheets',
            condition=pattern['condition'],
            true_action=pattern['true_action'],
            false_action=pattern['false_action'],
        )
        examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    return examples

def generate_multi_step_examples():
    """Generate multi-step sequential workflow examples."""
    examples = []
    
    patterns = [
        {
            'instruction': 'When a webhook is received, create a HubSpot contact, then send Slack notification to #sales, then add to Google Sheets.',
            'steps': [
                {'type': 'hubspot', 'action': 'create_contact', 'name': 'Create HubSpot Contact'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Notify Slack', 'channel': '#sales'},
                {'type': 'google-sheets', 'action': 'insert_row', 'name': 'Add to Sheets'},
            ],
        },
        {
            'instruction': 'When a new file is added to Google Drive, summarize it with AI, then send the summary via email, then post to Slack #updates.',
            'steps': [
                {'type': 'text-ai', 'action': 'summarizeText', 'name': 'Summarize File'},
                {'type': 'gmail', 'action': 'send_email', 'name': 'Send Email'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Post to Slack', 'channel': '#updates'},
            ],
        },
        {
            'instruction': 'When a new row is added in Google Sheets, create a Notion page, then send Slack notification to #notifications.',
            'steps': [
                {'type': 'notion', 'action': 'create_page', 'name': 'Create Notion Page'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Notify Slack', 'channel': '#notifications'},
            ],
        },
    ]
    
    for pattern in patterns:
        output = build_sequential_flow(
            trigger_type='webhook' if 'webhook' in pattern['instruction'].lower() else 'google-sheets',
            steps=pattern['steps'],
        )
        examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    return examples

def generate_schedule_examples():
    """Generate schedule-based trigger examples."""
    examples = []
    
    patterns = [
        {
            'instruction': 'Every day at 9 AM, get data from Google Sheets, then send summary email.',
            'schedule': 'every_day',
            'steps': [
                {'type': 'google-sheets', 'action': 'get_values', 'name': 'Get Sheet Data'},
                {'type': 'gmail', 'action': 'send_email', 'name': 'Send Summary'},
            ],
        },
        {
            'instruction': 'Every Monday at 8 AM, send Slack message to #weekly-update with weekly report.',
            'schedule': 'every_week',
            'steps': [
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Weekly Update', 'channel': '#weekly-update'},
            ],
        },
    ]
    
    for pattern in patterns:
        output = build_schedule_flow(
            schedule=pattern['schedule'],
            steps=pattern['steps'],
        )
        examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    return examples

def build_router_flow(trigger_type, condition, true_action, false_action):
    """Build a flow with ROUTER conditional logic."""
    trigger_piece = '@activepieces/piece-webhook' if trigger_type == 'webhook' else '@activepieces/piece-google-sheets'
    trigger_name = 'catch_webhook' if trigger_type == 'webhook' else 'new_row'
    trigger_display = 'Webhook Trigger' if trigger_type == 'webhook' else 'New Row Added'
    
    trigger_input = {}
    if trigger_type == 'google-sheets':
        trigger_input = {
            'spreadsheetId': '__TODO_SPREADSHEET_ID__',
            'sheetId': '__TODO_SHEET_ID__',
        }
    
    true_action_obj = build_action(true_action, 'step_true')
    false_action_obj = build_action(false_action, 'step_false')
    
    condition_obj = {
        'firstValue': condition['field'],
        'operator': condition['operator'],
    }
    if condition['value'] is not None:
        condition_obj['secondValue'] = condition['value']
    
    return {
        'displayName': f"{trigger_display} Conditional",
        'trigger': {
            'name': 'trigger',
            'type': 'PIECE_TRIGGER',
            'valid': True,
            'displayName': trigger_display,
            'settings': {
                'pieceName': trigger_piece,
                'pieceVersion': PIECE_VERSIONS.get(trigger_type.replace('-', '-'), '~1.0.0'),
                'triggerName': trigger_name,
                'input': trigger_input,
                'propertySettings': {},
            },
            'nextAction': {
                'name': 'step_router',
                'type': 'ROUTER',
                'valid': True,
                'displayName': 'Check Condition',
                'settings': {
                    'executionType': 'EXECUTE_FIRST_MATCH',
                    'branches': [
                        {
                            'branchType': 'CONDITION',
                            'branchName': 'Condition True',
                            'conditions': [[condition_obj]],
                        },
                        {
                            'branchType': 'FALLBACK',
                            'branchName': 'Condition False',
                        },
                    ],
                    'propertySettings': {},
                },
                'children': [true_action_obj, false_action_obj],
            },
        },
        'schemaVersion': None,
    }

def build_sequential_flow(trigger_type, steps):
    """Build a sequential multi-step flow."""
    trigger_piece = '@activepieces/piece-webhook' if trigger_type == 'webhook' else '@activepieces/piece-google-sheets'
    trigger_name = 'catch_webhook' if trigger_type == 'webhook' else 'new_row'
    trigger_display = 'Webhook Trigger' if trigger_type == 'webhook' else 'New Row Added'
    
    trigger_input = {}
    if trigger_type == 'google-sheets':
        trigger_input = {
            'spreadsheetId': '__TODO_SPREADSHEET_ID__',
            'sheetId': '__TODO_SHEET_ID__',
        }
    
    # Build action chain
    current_action = None
    for i, step in enumerate(reversed(steps)):
        action = build_action(step, f'step_{len(steps) - i}')
        if current_action:
            action['nextAction'] = current_action
        current_action = action
    
    return {
        'displayName': ' '.join([s['name'] for s in steps]),
        'trigger': {
            'name': 'trigger',
            'type': 'PIECE_TRIGGER',
            'valid': True,
            'displayName': trigger_display,
            'settings': {
                'pieceName': trigger_piece,
                'pieceVersion': PIECE_VERSIONS.get(trigger_type.replace('-', '-'), '~1.0.0'),
                'triggerName': trigger_name,
                'input': trigger_input,
                'propertySettings': {},
            },
            'nextAction': current_action,
        },
        'schemaVersion': None,
    }

def build_schedule_flow(schedule, steps):
    """Build a schedule-based flow."""
    schedule_map = {
        'every_day': {'name': 'every_day', 'display': 'Every Day'},
        'every_week': {'name': 'every_week', 'display': 'Every Week'},
    }
    schedule_info = schedule_map.get(schedule, schedule_map['every_day'])
    
    # Build action chain
    current_action = None
    for i, step in enumerate(reversed(steps)):
        action = build_action(step, f'step_{len(steps) - i}')
        if current_action:
            action['nextAction'] = current_action
        current_action = action
    
    return {
        'displayName': f"{schedule_info['display']} Workflow",
        'trigger': {
            'name': 'trigger',
            'type': 'PIECE_TRIGGER',
            'valid': True,
            'displayName': schedule_info['display'],
            'settings': {
                'pieceName': '@activepieces/piece-schedule',
                'pieceVersion': PIECE_VERSIONS['schedule'],
                'triggerName': schedule_info['name'],
                'input': {
                    'timezone': 'UTC',
                    'hour_of_the_day': 9,
                },
                'propertySettings': {},
            },
            'nextAction': current_action,
        },
        'schemaVersion': None,
    }

def build_action(action_spec, name):
    """Build an action object."""
    piece_type = action_spec['type']
    action_name = action_spec['action']
    display_name = action_spec.get('name', action_name)
    
    piece_name_map = {
        'slack': '@activepieces/piece-slack',
        'gmail': '@activepieces/piece-gmail',
        'google-sheets': '@activepieces/piece-google-sheets',
        'hubspot': '@activepieces/piece-hubspot',
        'notion': '@activepieces/piece-notion',
        'airtable': '@activepieces/piece-airtable',
        'text-ai': '@activepieces/piece-text-ai',
        'openai': '@activepieces/piece-openai',
        'http': '@activepieces/piece-http',
        'google-drive': '@activepieces/piece-google-drive',
    }
    
    piece_name = piece_name_map.get(piece_type, f'@activepieces/piece-{piece_type}')
    
    # Build input based on action type
    input_obj = {}
    if piece_type == 'slack' and action_name == 'send_channel_message':
        input_obj = {
            'channel': action_spec.get('channel', '#general'),
            'text': f"Notification from {display_name}",
        }
    elif piece_type == 'gmail' and action_name == 'send_email':
        input_obj = {
            'receiver': ['example@example.com'],
            'subject': 'Notification',
            'body': 'This is a notification.',
            'body_type': 'plain_text',
        }
    elif piece_type == 'google-sheets' and action_name == 'insert_row':
        input_obj = {
            'spreadsheetId': '__TODO_SPREADSHEET_ID__',
            'sheetId': '__TODO_SHEET_ID__',
            'values': '{{trigger.body}}',
        }
    elif piece_type == 'hubspot' and action_name == 'create_contact':
        input_obj = {
            'email': '{{trigger.body.email}}',
            'firstname': '{{trigger.body.firstname}}',
            'lastname': '{{trigger.body.lastname}}',
        }
    
    return {
        'name': name,
        'type': 'PIECE',
        'valid': True,
        'displayName': display_name,
        'settings': {
            'pieceName': piece_name,
            'pieceVersion': PIECE_VERSIONS.get(piece_type.replace('-', '-'), '~1.0.0'),
            'actionName': action_name,
            'input': input_obj,
            'propertySettings': {},
        },
    }

def generate_all_examples():
    """Generate all examples."""
    all_examples = []
    
    print("Generating webhook conditional examples...")
    all_examples.extend(generate_webhook_conditional_examples())
    
    print("Generating sheets conditional examples...")
    all_examples.extend(generate_sheets_conditional_examples())
    
    print("Generating multi-step examples...")
    all_examples.extend(generate_multi_step_examples())
    
    print("Generating schedule examples...")
    all_examples.extend(generate_schedule_examples())
    
    # Generate more variations
    print("Generating additional variations...")
    
    # More conditional patterns
    for i in range(50):
        trigger_type = random.choice(['webhook', 'google-sheets'])
        operators = OPERATORS['number'] + OPERATORS['text'] + OPERATORS['exists']
        operator = random.choice(operators)
        
        field = '{{trigger.body.value}}' if trigger_type == 'webhook' else '{{trigger.values.value}}'
        value = str(random.randint(1, 100)) if 'NUMBER' in operator else ('test' if 'TEXT' in operator else None)
        
        true_action_type = random.choice(['slack', 'gmail', 'hubspot'])
        false_action_type = random.choice(['slack', 'gmail', 'google-sheets'])
        
        condition = {'field': field, 'operator': operator, 'value': value}
        true_action = {'type': true_action_type, 'action': get_action_for_type(true_action_type), 'channel': '#general' if true_action_type == 'slack' else None}
        false_action = {'type': false_action_type, 'action': get_action_for_type(false_action_type), 'channel': '#general' if false_action_type == 'slack' else None}
        
        output = build_router_flow(trigger_type, condition, true_action, false_action)
        
        instruction = f"When a {'webhook is received' if trigger_type == 'webhook' else 'new row is added in Google Sheets'}, if {field} {operator.lower().replace('_', ' ')} {value if value else ''} then {true_action_type}, else {false_action_type}."
        
        all_examples.append({
            'instruction': instruction,
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    # More sequential patterns
    for i in range(60):
        num_steps = random.randint(2, 4)
        action_types = random.sample(['slack', 'gmail', 'google-sheets', 'hubspot', 'notion'], num_steps)
        
        steps = []
        for j, action_type in enumerate(action_types):
            steps.append({
                'type': action_type,
                'action': get_action_for_type(action_type),
                'name': f"{action_type.title()} Step {j+1}",
                'channel': '#general' if action_type == 'slack' else None,
            })
        
        trigger_type = random.choice(['webhook', 'google-sheets'])
        output = build_sequential_flow(trigger_type, steps)
        
        step_names = ' → '.join([s['name'] for s in steps])
        instruction = f"When a {'webhook is received' if trigger_type == 'webhook' else 'new row is added in Google Sheets'}, {step_names.lower()}."
        
        all_examples.append({
            'instruction': instruction,
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    # Generate more specific real-world patterns
    print("Generating real-world patterns...")
    
    real_world_patterns = [
        {
            'instruction': 'When a payment webhook is received, if amount is greater than 500 then send email to finance@example.com, else send Slack notification to #payments.',
            'trigger': 'webhook',
            'condition': {'field': '{{trigger.body.amount}}', 'operator': 'NUMBER_IS_GREATER_THAN', 'value': '500'},
            'true_action': {'type': 'gmail', 'action': 'send_email'},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#payments'},
        },
        {
            'instruction': 'When a form submission webhook is received, if email contains "@company.com" then create HubSpot contact, else send Slack alert to #external-leads.',
            'trigger': 'webhook',
            'condition': {'field': '{{trigger.body.email}}', 'operator': 'TEXT_CONTAINS', 'value': '@company.com'},
            'true_action': {'type': 'hubspot', 'action': 'create_contact'},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#external-leads'},
        },
        {
            'instruction': 'When a new order is added in Google Sheets, if total is greater than 1000 then send email to sales@example.com, else add to Airtable.',
            'trigger': 'google-sheets',
            'condition': {'field': '{{trigger.values.total}}', 'operator': 'NUMBER_IS_GREATER_THAN', 'value': '1000'},
            'true_action': {'type': 'gmail', 'action': 'send_email'},
            'false_action': {'type': 'airtable', 'action': 'create_record'},
        },
        {
            'instruction': 'When a webhook is received, if the user type equals "premium" then send email, else post to Slack #free-users.',
            'trigger': 'webhook',
            'condition': {'field': '{{trigger.body.userType}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'premium'},
            'true_action': {'type': 'gmail', 'action': 'send_email'},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#free-users'},
        },
        {
            'instruction': 'When a new lead is added in Google Sheets, if score is greater than 75 then create HubSpot contact and notify Slack #high-value, else just notify Slack #leads.',
            'trigger': 'google-sheets',
            'condition': {'field': '{{trigger.values.score}}', 'operator': 'NUMBER_IS_GREATER_THAN', 'value': '75'},
            'true_action': {'type': 'hubspot', 'action': 'create_contact'},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#leads'},
        },
        {
            'instruction': 'When a webhook is received, if status equals "urgent" then send Slack alert to #urgent, else add to Google Sheets.',
            'trigger': 'webhook',
            'condition': {'field': '{{trigger.body.status}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'urgent'},
            'true_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#urgent'},
            'false_action': {'type': 'google-sheets', 'action': 'insert_row'},
        },
        {
            'instruction': 'When a new row is added in Google Sheets, if the category equals "VIP" then send email to vip@example.com, else post to Slack #general.',
            'trigger': 'google-sheets',
            'condition': {'field': '{{trigger.values.category}}', 'operator': 'TEXT_IS_EXACTLY', 'value': 'VIP'},
            'true_action': {'type': 'gmail', 'action': 'send_email'},
            'false_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#general'},
        },
        {
            'instruction': 'When a webhook is received, if the source field does not exist then send Slack alert to #errors, else create HubSpot contact.',
            'trigger': 'webhook',
            'condition': {'field': '{{trigger.body.source}}', 'operator': 'DOES_NOT_EXIST', 'value': None},
            'true_action': {'type': 'slack', 'action': 'send_channel_message', 'channel': '#errors'},
            'false_action': {'type': 'hubspot', 'action': 'create_contact'},
        },
    ]
    
    for pattern in real_world_patterns:
        output = build_router_flow(
            trigger_type=pattern['trigger'],
            condition=pattern['condition'],
            true_action=pattern['true_action'],
            false_action=pattern['false_action'],
        )
        all_examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    # More multi-step real-world patterns
    multi_step_patterns = [
        {
            'instruction': 'When a webhook is received, create a HubSpot contact, then send Slack notification to #sales, then add to Google Sheets for tracking.',
            'trigger': 'webhook',
            'steps': [
                {'type': 'hubspot', 'action': 'create_contact', 'name': 'Create HubSpot Contact'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Notify Sales', 'channel': '#sales'},
                {'type': 'google-sheets', 'action': 'insert_row', 'name': 'Add to Tracking Sheet'},
            ],
        },
        {
            'instruction': 'When a new file is uploaded to Google Drive, summarize it with AI, then send email with summary, then post to Slack #updates.',
            'trigger': 'webhook',
            'steps': [
                {'type': 'text-ai', 'action': 'summarizeText', 'name': 'Summarize File'},
                {'type': 'gmail', 'action': 'send_email', 'name': 'Send Summary Email'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Post Update', 'channel': '#updates'},
            ],
        },
        {
            'instruction': 'When a new row is added in Google Sheets, create a Notion page, then send Slack notification to #notifications, then send email confirmation.',
            'trigger': 'google-sheets',
            'steps': [
                {'type': 'notion', 'action': 'create_page', 'name': 'Create Notion Page'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Notify Team', 'channel': '#notifications'},
                {'type': 'gmail', 'action': 'send_email', 'name': 'Send Confirmation'},
            ],
        },
        {
            'instruction': 'When a webhook is received, add to Google Sheets, then create HubSpot contact, then send Slack message to #new-leads.',
            'trigger': 'webhook',
            'steps': [
                {'type': 'google-sheets', 'action': 'insert_row', 'name': 'Log to Sheets'},
                {'type': 'hubspot', 'action': 'create_contact', 'name': 'Create Contact'},
                {'type': 'slack', 'action': 'send_channel_message', 'name': 'Notify Team', 'channel': '#new-leads'},
            ],
        },
    ]
    
    for pattern in multi_step_patterns:
        output = build_sequential_flow(
            trigger_type=pattern['trigger'],
            steps=pattern['steps'],
        )
        all_examples.append({
            'instruction': pattern['instruction'],
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
        num_steps = random.randint(2, 4)
        action_types = random.sample(['slack', 'gmail', 'google-sheets', 'hubspot', 'notion'], num_steps)
        
        steps = []
        for j, action_type in enumerate(action_types):
            steps.append({
                'type': action_type,
                'action': get_action_for_type(action_type),
                'name': f"{action_type.title()} Step {j+1}",
                'channel': '#general' if action_type == 'slack' else None,
            })
        
        trigger_type = random.choice(['webhook', 'google-sheets'])
        output = build_sequential_flow(trigger_type, steps)
        
        step_names = ' → '.join([s['name'] for s in steps])
        instruction = f"When a {'webhook is received' if trigger_type == 'webhook' else 'new row is added in Google Sheets'}, {step_names.lower()}."
        
        all_examples.append({
            'instruction': instruction,
            'input': '',
            'output': json.dumps(output, separators=(',', ':')),
            'system': 'You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
        })
    
    return all_examples

def get_action_for_type(action_type):
    """Get default action name for piece type."""
    action_map = {
        'slack': 'send_channel_message',
        'gmail': 'send_email',
        'google-sheets': 'insert_row',
        'hubspot': 'create_contact',
        'notion': 'create_page',
        'airtable': 'create_record',
        'text-ai': 'summarizeText',
    }
    return action_map.get(action_type, 'send_message')

if __name__ == '__main__':
    print("=" * 70)
    print("GENERATING 100+ TRAINING EXAMPLES")
    print("=" * 70)
    
    examples = generate_all_examples()
    
    print(f"\nGenerated {len(examples)} examples")
    print(f"\nSaving to: many_training_examples.json")
    
    with open('many_training_examples.json', 'w', encoding='utf-8') as f:
        json.dump(examples, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Success! Generated {len(examples)} examples")
    print(f"\nBreakdown:")
    print(f"  - Webhook conditionals: {len([e for e in examples if 'webhook' in e['instruction'].lower() and 'if' in e['instruction'].lower()])}")
    print(f"  - Sheets conditionals: {len([e for e in examples if 'sheets' in e['instruction'].lower() and 'if' in e['instruction'].lower()])}")
    print(f"  - Multi-step workflows: {len([e for e in examples if 'if' not in e['instruction'].lower()])}")
    print(f"\nReady to add to training set!")

