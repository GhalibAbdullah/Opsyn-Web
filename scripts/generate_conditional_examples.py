#!/usr/bin/env python3
"""
Generate training examples for conditional logic (ROUTER) patterns
to augment the training set.
"""

import json

examples = [
    {
        "instruction": "When a webhook is received, if email is missing then send Slack alert to #ops, else add to Google Sheets.",
        "input": "",
        "output": json.dumps({
            "displayName": "Webhook Conditional Processing",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "Webhook Trigger",
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "pieceVersion": "~1.0.0",
                    "triggerName": "catch_webhook",
                    "input": {},
                    "propertySettings": {}
                },
                "nextAction": {
                    "name": "step_router",
                    "type": "ROUTER",
                    "valid": True,
                    "displayName": "Check Email",
                    "settings": {
                        "executionType": "EXECUTE_FIRST_MATCH",
                        "branches": [
                            {
                                "branchType": "CONDITION",
                                "branchName": "Email Missing",
                                "conditions": [[
                                    {
                                        "firstValue": "{{trigger.body.email}}",
                                        "operator": "DOES_NOT_EXIST"
                                    }
                                ]]
                            },
                            {
                                "branchType": "FALLBACK",
                                "branchName": "Email Present"
                            }
                        ],
                        "propertySettings": {}
                    },
                    "children": [
                        {
                            "name": "step_slack",
                            "type": "PIECE",
                            "valid": True,
                            "displayName": "Send Slack Alert",
                            "settings": {
                                "pieceName": "@activepieces/piece-slack",
                                "pieceVersion": "~0.9.0",
                                "actionName": "send_channel_message",
                                "input": {
                                    "channel": "#ops",
                                    "text": "⚠️ Webhook received without email: {{trigger.body}}"
                                },
                                "propertySettings": {}
                            }
                        },
                        {
                            "name": "step_sheets",
                            "type": "PIECE",
                            "valid": True,
                            "displayName": "Add to Google Sheets",
                            "settings": {
                                "pieceName": "@activepieces/piece-google-sheets",
                                "pieceVersion": "~0.11.0",
                                "actionName": "insert_row",
                                "input": {
                                    "spreadsheetId": "__TODO_SPREADSHEET_ID__",
                                    "sheetId": "__TODO_SHEET_ID__",
                                    "values": "{{trigger.body}}"
                                },
                                "propertySettings": {}
                            }
                        }
                    ]
                }
            },
            "schemaVersion": None
        }, indent=2),
        "system": "You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text."
    },
    {
        "instruction": "When a new row is added in Google Sheets, if leadScore >= 80 then send an email, else post to Slack.",
        "input": "",
        "output": json.dumps({
            "displayName": "Lead Score Routing",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "New Row Added",
                "settings": {
                    "pieceName": "@activepieces/piece-google-sheets",
                    "pieceVersion": "~0.11.0",
                    "triggerName": "new_row",
                    "input": {
                        "spreadsheetId": "__TODO_SPREADSHEET_ID__",
                        "sheetId": "__TODO_SHEET_ID__"
                    },
                    "propertySettings": {}
                },
                "nextAction": {
                    "name": "step_router",
                    "type": "ROUTER",
                    "valid": True,
                    "displayName": "Check Lead Score",
                    "settings": {
                        "executionType": "EXECUTE_FIRST_MATCH",
                        "branches": [
                            {
                                "branchType": "CONDITION",
                                "branchName": "High Score",
                                "conditions": [[
                                    {
                                        "firstValue": "{{trigger.values.leadScore}}",
                                        "secondValue": "80",
                                        "operator": "NUMBER_IS_GREATER_THAN"
                                    }
                                ]]
                            },
                            {
                                "branchType": "FALLBACK",
                                "branchName": "Low Score"
                            }
                        ],
                        "propertySettings": {}
                    },
                    "children": [
                        {
                            "name": "step_email",
                            "type": "PIECE",
                            "valid": True,
                            "displayName": "Send Email",
                            "settings": {
                                "pieceName": "@activepieces/piece-gmail",
                                "pieceVersion": "~0.8.0",
                                "actionName": "send_email",
                                "input": {
                                    "receiver": ["sales@example.com"],
                                    "subject": "High Score Lead: {{trigger.values.name}}",
                                    "body": "Lead Score: {{trigger.values.leadScore}}\nName: {{trigger.values.name}}"
                                },
                                "propertySettings": {}
                            }
                        },
                        {
                            "name": "step_slack",
                            "type": "PIECE",
                            "valid": True,
                            "displayName": "Post to Slack",
                            "settings": {
                                "pieceName": "@activepieces/piece-slack",
                                "pieceVersion": "~0.9.0",
                                "actionName": "send_channel_message",
                                "input": {
                                    "channel": "#leads",
                                    "text": "New lead (score {{trigger.values.leadScore}}): {{trigger.values.name}}"
                                },
                                "propertySettings": {}
                            }
                        }
                    ]
                }
            },
            "schemaVersion": None
        }, indent=2),
        "system": "You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text."
    },
    {
        "instruction": "When someone fills a contact form (webhook), create a HubSpot contact and notify Slack.",
        "input": "",
        "output": json.dumps({
            "displayName": "Contact Form to HubSpot and Slack",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "Contact Form Webhook",
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "pieceVersion": "~1.0.0",
                    "triggerName": "catch_webhook",
                    "input": {},
                    "propertySettings": {}
                },
                "nextAction": {
                    "name": "step_hubspot",
                    "type": "PIECE",
                    "valid": True,
                    "displayName": "Create HubSpot Contact",
                    "settings": {
                        "pieceName": "@activepieces/piece-hubspot",
                        "pieceVersion": "~0.5.0",
                        "actionName": "create_contact",
                        "input": {
                            "email": "{{trigger.body.email}}",
                            "firstname": "{{trigger.body.firstname}}",
                            "lastname": "{{trigger.body.lastname}}",
                            "phone": "{{trigger.body.phone}}",
                            "company": "{{trigger.body.company}}"
                        },
                        "propertySettings": {}
                    },
                    "nextAction": {
                        "name": "step_slack",
                        "type": "PIECE",
                        "valid": True,
                        "displayName": "Notify Slack",
                        "settings": {
                            "pieceName": "@activepieces/piece-slack",
                            "pieceVersion": "~0.9.0",
                            "actionName": "send_channel_message",
                            "input": {
                                "channel": "#sales",
                                "text": "🆕 New contact created in HubSpot:\nName: {{trigger.body.firstname}} {{trigger.body.lastname}}\nEmail: {{trigger.body.email}}\nCompany: {{trigger.body.company}}"
                            },
                            "propertySettings": {}
                        }
                    }
                }
            },
            "schemaVersion": None
        }, indent=2),
        "system": "You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text."
    }
]

print(json.dumps(examples, indent=2))

