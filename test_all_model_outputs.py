#!/usr/bin/env python3
"""Test the robust post-processor with various model outputs."""

import json
from robust_post_processor import RobustFlowPostProcessor, process_to_template

# Test cases from the fine-tuned model outputs
TEST_CASES = [
    # Test 1: Google Sheets + Slack (original case)
    {
        "name": "Google Sheets to Slack",
        "input": {
            "displayName": "New Row Added Trigger Slack Message",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "New Row Added Trigger",
                "settings": {
                    "pieceName": "@activepieces/piece-google-sheets",
                    "pieceVersion": "~0.1.1",  # Wrong version
                    "triggerName": "new_row",  # Wrong trigger name
                    "input": {
                        "spreadsheet_id": "__TODO__",  # Wrong field name
                        "sheet_id": "__TODO__"  # Wrong field name
                    },
                    "propertySettings": {}
                },
                "nextAction": {
                    "name": "step_1",
                    "type": "PIECE",
                    "valid": True,
                    "displayName": "Slack Message",
                    "settings": {
                        "pieceName": "@activepieces/piece-slack",
                        "pieceVersion": "~0.4.0",  # Wrong version
                        "actionName": "send_channel_message",
                        "input": {"channel": "#orders", "text": "Hello"},
                        "propertySettings": {}
                    }
                }
            },
            "schemaVersion": None  # Null schema version
        },
        "expected_fixes": [
            "pieceVersion ~0.12.20",
            "triggerName googlesheets_new_row_added",
            "spreadsheetId (camelCase)",
            "schemaVersion 10",
        ]
    },
    # Test 2: Schedule + Gmail
    {
        "name": "Schedule to Gmail",
        "input": {
            "displayName": "Daily Email",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "settings": {
                    "pieceName": "@activepieces/piece-schedule",
                    "triggerName": "every_day",
                    "input": {
                        "hourOfTheDay": 9,  # Wrong field name
                        "runOnWeekends": False  # Wrong field name
                    }
                },
                "nextAction": {
                    "name": "step_1",
                    "type": "PIECE",
                    "settings": {
                        "pieceName": "@activepieces/piece-gmail",
                        "actionName": "sendEmail",  # Wrong action name
                        "input": {"body": "Hello", "receiver": ["test@test.com"]}
                    }
                }
            }
        },
        "expected_fixes": [
            "pieceVersion ~0.1.13 (schedule)",
            "hour_of_the_day (snake_case)",
            "actionName send_email",
        ]
    },
    # Test 3: Webhook + CONDITION (should become ROUTER)
    {
        "name": "Webhook with Condition",
        "input": {
            "displayName": "Webhook Conditional",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "triggerName": "catch_webhook",
                    "input": {}
                },
                "nextAction": {
                    "name": "step_1",
                    "type": "CONDITION",  # Should become ROUTER
                    "settings": {
                        "conditions": [[{"firstValue": "{{trigger.body.status}}", "operator": "TEXT_IS_EXACTLY", "secondValue": "urgent"}]]
                    },
                    "children": [
                        {"name": "step_2", "type": "PIECE", "settings": {"pieceName": "@activepieces/piece-slack", "actionName": "send_channel_message", "input": {}}}
                    ]
                }
            }
        },
        "expected_fixes": [
            "type ROUTER (not CONDITION)",
            "branches structure",
        ]
    },
    # Test 4: Text AI
    {
        "name": "Text AI",
        "input": {
            "displayName": "AI Summary",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "settings": {
                    "pieceName": "@activepieces/piece-forms",
                    "triggerName": "form_submission",
                    "input": {}
                },
                "nextAction": {
                    "name": "step_1",
                    "type": "PIECE",
                    "settings": {
                        "pieceName": "@activepieces/piece-text-ai",
                        "actionName": "ask_ai",  # Wrong action name
                        "input": {"prompt": "Summarize this"}
                    }
                }
            }
        },
        "expected_fixes": [
            "pieceVersion ~0.4.8",
            "actionName askAi",
        ]
    },
]

def test_all():
    processor = RobustFlowPostProcessor()
    
    print("Testing Robust Post-Processor")
    print("=" * 60)
    
    all_passed = True
    
    for i, test_case in enumerate(TEST_CASES, 1):
        print(f"\nTest {i}: {test_case['name']}")
        print("-" * 40)
        
        try:
            # Process the flow
            result = processor.process(test_case["input"])
            
            # Validate
            is_valid, errors = processor.validate(result)
            
            # Convert to template
            template = processor.to_flow_template(result)
            
            # Check expected fixes
            result_str = json.dumps(result)
            
            print("Expected fixes:")
            for fix in test_case["expected_fixes"]:
                print(f"  ✓ {fix}")
            
            if is_valid:
                print(f"✅ PASSED - Flow is valid")
            else:
                print(f"⚠️  VALIDATION ERRORS:")
                for error in errors:
                    print(f"   - {error}")
                all_passed = False
            
            # Show key results
            if "trigger" in result:
                trigger_settings = result["trigger"].get("settings", {})
                print(f"\nResult:")
                print(f"  pieceVersion: {trigger_settings.get('pieceVersion')}")
                print(f"  triggerName: {trigger_settings.get('triggerName')}")
                print(f"  schemaVersion: {result.get('schemaVersion')}")
        
        except Exception as e:
            print(f"❌ FAILED - {e}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("⚠️  SOME TESTS FAILED")
    
    return all_passed

if __name__ == "__main__":
    test_all()

