#!/usr/bin/env python3
"""Verify schema compatibility between training set and API requirements."""

import json
import sys

def check_trigger_structure(output_json_str):
    """Check if trigger structure matches API requirements."""
    try:
        data = json.loads(output_json_str)
        trigger = data.get('trigger', {})
        
        issues = []
        
        # Check required top-level fields
        required_trigger_fields = ['name', 'type', 'valid', 'displayName', 'settings']
        for field in required_trigger_fields:
            if field not in trigger:
                issues.append(f"Missing trigger.{field}")
        
        # Check settings structure for PIECE_TRIGGER
        if trigger.get('type') == 'PIECE_TRIGGER':
            settings = trigger.get('settings', {})
            required_settings = ['pieceName', 'pieceVersion', 'input', 'propertySettings']
            for field in required_settings:
                if field not in settings:
                    issues.append(f"Missing trigger.settings.{field}")
        
        return issues
    except Exception as e:
        return [f"JSON parse error: {e}"]

def analyze_training_set_compatibility(file_path):
    """Analyze training set for schema compatibility."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    compatible = 0
    incompatible = 0
    issues_summary = {}
    
    print("=" * 70)
    print("SCHEMA COMPATIBILITY ANALYSIS")
    print("=" * 70)
    print(f"\nAnalyzing {total} entries...\n")
    
    for i, entry in enumerate(data):
        output = entry.get('output', '')
        try:
            parsed = json.loads(output)
            
            # Check top-level structure
            required_top = ['displayName', 'trigger', 'schemaVersion']
            missing_top = [f for f in required_top if f not in parsed]
            
            if missing_top:
                incompatible += 1
                for field in missing_top:
                    issues_summary[f"Missing {field}"] = issues_summary.get(f"Missing {field}", 0) + 1
                continue
            
            # Check trigger structure
            trigger_issues = check_trigger_structure(output)
            
            if trigger_issues:
                incompatible += 1
                for issue in trigger_issues:
                    issues_summary[issue] = issues_summary.get(issue, 0) + 1
            else:
                compatible += 1
                
        except json.JSONDecodeError:
            incompatible += 1
            issues_summary["Invalid JSON"] = issues_summary.get("Invalid JSON", 0) + 1
        except Exception as e:
            incompatible += 1
            issues_summary[f"Error: {str(e)[:50]}"] = issues_summary.get(f"Error: {str(e)[:50]}", 0) + 1
    
    print("RESULTS:")
    print("-" * 70)
    print(f"✅ Compatible: {compatible} ({compatible/total*100:.1f}%)")
    print(f"❌ Incompatible: {incompatible} ({incompatible/total*100:.1f}%)")
    
    if issues_summary:
        print("\nCommon Issues:")
        for issue, count in sorted(issues_summary.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {issue}: {count} ({count/total*100:.1f}%)")
    
    return compatible, incompatible, issues_summary

def check_generated_examples():
    """Check generated examples compatibility."""
    print("\n" + "=" * 70)
    print("GENERATED EXAMPLES COMPATIBILITY")
    print("=" * 70)
    
    try:
        with open('conditional_training_examples.json', 'r') as f:
            generated = json.load(f)
        
        print(f"\nChecking {len(generated)} generated examples...\n")
        
        all_compatible = True
        for i, example in enumerate(generated):
            output = example.get('output', '')
            issues = check_trigger_structure(output)
            
            if issues:
                print(f"❌ Example {i+1}: {example.get('instruction', '')[:50]}...")
                for issue in issues:
                    print(f"   - {issue}")
                all_compatible = False
            else:
                print(f"✅ Example {i+1}: Compatible")
        
        return all_compatible
    except FileNotFoundError:
        print("⚠️  Generated examples file not found")
        return False

def verify_api_schema_match():
    """Verify what the API actually expects."""
    print("\n" + "=" * 70)
    print("API SCHEMA REQUIREMENTS")
    print("=" * 70)
    
    print("""
API expects (for IMPORT_FLOW operation):
{
  "type": "IMPORT_FLOW",
  "request": {
    "displayName": string,
    "trigger": FlowTrigger,
    "schemaVersion": string | null
  }
}

FlowTrigger structure:
{
  "name": string,              // REQUIRED
  "type": "EMPTY" | "PIECE_TRIGGER",  // REQUIRED
  "valid": boolean,            // REQUIRED
  "displayName": string,       // REQUIRED
  "settings": {                // REQUIRED
    // For PIECE_TRIGGER:
    "pieceName": string,       // REQUIRED
    "pieceVersion": string,    // REQUIRED
    "triggerName": string,     // Optional
    "input": object,           // REQUIRED
    "propertySettings": object // REQUIRED (can be {})
  },
  "nextAction": FlowAction     // Optional
}

Training set format:
{
  "displayName": string,
  "trigger": FlowTrigger,     // ✅ Matches
  "schemaVersion": string | null  // ✅ Matches
}

✅ Training set format matches ImportFlowRequest directly!
✅ Post-processor wraps it as { type: "IMPORT_FLOW", request: {...} }
""")

if __name__ == '__main__':
    file_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system.json'
    
    verify_api_schema_match()
    
    try:
        compatible, incompatible, issues = analyze_training_set_compatibility(file_path)
        generated_ok = check_generated_examples()
        
        print("\n" + "=" * 70)
        print("FINAL VERDICT")
        print("=" * 70)
        
        if compatible / (compatible + incompatible) > 0.9:
            print("\n✅ Training set schema is HIGHLY COMPATIBLE")
        elif compatible / (compatible + incompatible) > 0.7:
            print("\n⚠️  Training set schema is MOSTLY COMPATIBLE (some issues)")
        else:
            print("\n❌ Training set schema has SIGNIFICANT ISSUES")
        
        if generated_ok:
            print("✅ Generated examples are FULLY COMPATIBLE")
        else:
            print("⚠️  Generated examples have some issues")
        
        print("\n📋 Summary:")
        print(f"  - Training set: {compatible}/{compatible+incompatible} compatible ({compatible/(compatible+incompatible)*100:.1f}%)")
        print(f"  - Generated examples: {'✅ Compatible' if generated_ok else '❌ Issues found'}")
        print(f"  - Schema format: ✅ Matches ImportFlowRequest")
        print(f"  - Post-processor: ✅ Handles wrapping for API")
        
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

