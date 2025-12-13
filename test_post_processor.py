#!/usr/bin/env python3
"""Test the post-processor with example model outputs."""

import json
from post_processor import FlowPostProcessor, post_process_flow

# Test cases from fine-tuned model outputs
test_cases = [
    {
        "name": "Output 1: Google Sheets → Slack",
        "input": '{"displayName":"New Row Added Trigger Slack Message","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added Trigger","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#orders","text":"Notification from send_channel_message"},"propertySettings":{}}}},"schemaVersion":null}'
    },
    {
        "name": "Output 2: Webhook Conditional",
        "input": '{"displayName":"Webhook Trigger Conditional Email Or Insert Row","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook Trigger","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.0.1","triggerName":"catch_webhook","input":{},"propertySettings":{}},"nextAction":{"name":"step_1","type":"CONDITION","valid":true,"displayName":"Check Status","settings":{"executionType":"FALL_THROUGH","conditions":[[{"firstValue":"{{trigger.body.status}}","operator":"TEXT_IS_EXACTLY","secondValue":"urgent"}]]},"children":[{"name":"step_2","type":"PIECE","valid":true,"displayName":"send_email","settings":{"pieceName":"@activepieces/piece-gmail","pieceVersion":"~0.0.1","actionName":"compose_and_send_email","input":{"receiver":["support@company.com"],"subject":"Notification","body":"This is a notification.","body_type":"plain_text"},"propertySettings":{}}},{"name":"step_3","type":"PIECE","valid":true,"displayName":"insert_row","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","actionName":"insert_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__","values":"{{trigger.body}}"},"propertySettings":{}}}]}},"schemaVersion":null}'
    }
]

def main():
    print("=" * 80)
    print("POST-PROCESSOR TEST")
    print("=" * 80)
    print()
    
    processor = FlowPostProcessor()
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print("-" * 80)
        
        try:
            # Process
            processed = processor.process_string(test_case['input'])
            
            # Validate
            is_valid, errors = processor.validate(processed)
            
            # Show results
            print(f"✅ Processing: SUCCESS")
            print(f"✅ Validation: {'PASS' if is_valid else 'FAIL'}")
            
            if errors:
                print("\n⚠️  Validation Errors:")
                for error in errors:
                    print(f"   - {error}")
            
            # Show key fixes
            print("\n🔧 Key Fixes Applied:")
            original = json.loads(test_case['input'])
            
            if original.get("schemaVersion") is None and processed.get("schemaVersion") == "10":
                print("   ✅ Fixed: schemaVersion null → '10'")
            
            if original.get("trigger", {}).get("nextAction", {}).get("type") == "CONDITION":
                if processed.get("trigger", {}).get("nextAction", {}).get("type") == "ROUTER":
                    print("   ✅ Fixed: CONDITION → ROUTER")
            
            # Save processed output
            output_file = f"test_output_{i}_processed.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(processed, f, indent=2, ensure_ascii=False)
            
            print(f"\n📁 Processed flow saved to: {output_file}")
            
            # Show summary
            print(f"\n📊 Summary:")
            print(f"   displayName: {processed.get('displayName', 'MISSING')}")
            print(f"   schemaVersion: {processed.get('schemaVersion', 'MISSING')}")
            print(f"   trigger.type: {processed.get('trigger', {}).get('type', 'MISSING')}")
            if processed.get('trigger', {}).get('nextAction'):
                print(f"   firstAction.type: {processed['trigger']['nextAction'].get('type', 'MISSING')}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        
        print()
        print("=" * 80)
        print()

if __name__ == "__main__":
    main()

