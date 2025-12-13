#!/usr/bin/env python3
"""
Test post-processor with a complete example flow.
Creates a ready-to-import flow for Activepieces.
"""

import json
from post_processor import post_process_flow, FlowPostProcessor
from prepare_for_activepieces import prepare_for_import

# Example: Output 1 from fine-tuned model (Google Sheets → Slack)
example_output = '''{"displayName":"New Row Added Trigger Slack Message","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"New Row Added Trigger","settings":{"pieceName":"@activepieces/piece-google-sheets","pieceVersion":"~0.1.1","triggerName":"new_row","input":{"spreadsheetId":"__TODO_SPREADSHEET_ID__","sheetId":"__TODO_SHEET_ID__"},"propertySettings":{}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Slack Message","settings":{"pieceName":"@activepieces/piece-slack","pieceVersion":"~0.4.0","actionName":"send_channel_message","input":{"channel":"#orders","text":"Notification from send_channel_message"},"propertySettings":{}}}},"schemaVersion":null}'''

def main():
    print("=" * 80)
    print("TESTING POST-PROCESSOR WITH EXAMPLE FLOW")
    print("=" * 80)
    print()
    
    # Step 1: Post-process
    print("Step 1: Post-processing flow...")
    try:
        processed = post_process_flow(example_output)
        print("✅ Post-processing successful!")
    except Exception as e:
        print(f"❌ Post-processing failed: {e}")
        return
    
    # Step 2: Validate
    print("\nStep 2: Validating processed flow...")
    processor = FlowPostProcessor()
    is_valid, errors = processor.validate(processed)
    
    if is_valid:
        print("✅ Validation passed!")
    else:
        print("⚠️  Validation errors:")
        for error in errors:
            print(f"   - {error}")
    
    # Step 3: Prepare for API
    print("\nStep 3: Preparing for Activepieces API import...")
    try:
        import_payload = prepare_for_import(processed)
        print("✅ API payload prepared!")
    except Exception as e:
        print(f"❌ API preparation failed: {e}")
        return
    
    # Step 4: Save files
    print("\nStep 4: Saving files...")
    
    # Save processed flow
    with open('example_flow_processed.json', 'w', encoding='utf-8') as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)
    print("✅ Saved: example_flow_processed.json")
    
    # Save API payload
    with open('example_flow_for_import.json', 'w', encoding='utf-8') as f:
        json.dump(import_payload, f, indent=2, ensure_ascii=False)
    print("✅ Saved: example_flow_for_import.json")
    
    # Step 5: Show summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"displayName: {processed.get('displayName')}")
    print(f"schemaVersion: {processed.get('schemaVersion')}")
    print(f"trigger.type: {processed.get('trigger', {}).get('type')}")
    print(f"trigger.triggerName: {processed.get('trigger', {}).get('settings', {}).get('triggerName')}")
    print(f"firstAction.type: {processed.get('trigger', {}).get('nextAction', {}).get('type')}")
    print(f"firstAction.actionName: {processed.get('trigger', {}).get('nextAction', {}).get('settings', {}).get('actionName')}")
    
    print("\n" + "=" * 80)
    print("READY FOR TESTING")
    print("=" * 80)
    print("\nFiles created:")
    print("  1. example_flow_processed.json - Post-processed flow")
    print("  2. example_flow_for_import.json - Ready for Activepieces API")
    print("\nNext steps:")
    print("  1. Import example_flow_for_import.json into Activepieces")
    print("  2. Check if flow appears correctly in UI")
    print("  3. Verify trigger and action are configured properly")
    print("\nAPI Usage:")
    print("  POST /flows/:id")
    print("  Body: example_flow_for_import.json")

if __name__ == "__main__":
    main()

