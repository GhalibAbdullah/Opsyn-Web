#!/usr/bin/env python3
"""
Prepare processed flow for Activepieces API import.
Formats flow according to IMPORT_FLOW operation schema.
"""

import json
import sys
from post_processor import post_process_flow


def prepare_for_import(flow: dict) -> dict:
    """
    Prepare flow for Activepieces IMPORT_FLOW API operation.
    
    According to FLOW_SCHEMA.md, the API expects:
    {
        "type": "IMPORT_FLOW",
        "request": {
            "displayName": string,
            "trigger": FlowTrigger,
            "schemaVersion": string | null
        }
    }
    """
    # Extract the flow structure (displayName, trigger, schemaVersion)
    import_request = {
        "displayName": flow.get("displayName", "Untitled Flow"),
        "trigger": flow.get("trigger"),
        "schemaVersion": flow.get("schemaVersion", "10")
    }
    
    # Wrap in IMPORT_FLOW operation
    return {
        "type": "IMPORT_FLOW",
        "request": import_request
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python prepare_for_activepieces.py <input_file> [output_file]")
        print("\nExample:")
        print("  python prepare_for_activepieces.py test_output_1_processed.json flow_for_import.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "flow_for_activepieces_import.json"
    
    print(f"Reading flow from: {input_file}")
    
    # Read and process
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    try:
        # Post-process first
        print("Post-processing flow...")
        processed_flow = post_process_flow(content)
        
        # Prepare for API import
        print("Preparing for Activepieces API import...")
        import_payload = prepare_for_import(processed_flow)
        
        # Save
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(import_payload, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Flow prepared and saved to: {output_file}")
        print("\n📋 Import Payload Structure:")
        print(f"   type: {import_payload['type']}")
        print(f"   request.displayName: {import_payload['request']['displayName']}")
        print(f"   request.schemaVersion: {import_payload['request']['schemaVersion']}")
        print(f"   request.trigger.type: {import_payload['request']['trigger']['type']}")
        
        print("\n📝 Next Steps:")
        print("   1. Use this file with Activepieces API:")
        print(f"      POST /flows/:id")
        print(f"      Body: {output_file}")
        print("   2. Or import manually in Activepieces UI")
        print("   3. Check if flow appears correctly")
        
        # Also save the processed flow separately (without API wrapper)
        processed_file = output_file.replace('.json', '_processed_only.json')
        with open(processed_file, 'w', encoding='utf-8') as f:
            json.dump(processed_flow, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Also saved processed flow (without API wrapper) to: {processed_file}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

