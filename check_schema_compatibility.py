#!/usr/bin/env python3
"""Check schema compatibility between training data and Activepieces flow schema."""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Set

def analyze_flow_schema(flow_data: Dict[str, Any], entry_index: int) -> Dict[str, Any]:
    """Analyze a single flow's schema compatibility."""
    issues = []
    warnings = []
    info = {}
    
    # Check root level fields
    if "displayName" not in flow_data:
        issues.append("Missing 'displayName' at root level")
    else:
        info["has_displayName"] = True
    
    if "name" in flow_data:
        warnings.append("Has 'name' field at root (should use 'displayName' only)")
        info["has_name"] = True
    
    # Check schemaVersion
    if "schemaVersion" not in flow_data:
        warnings.append("Missing 'schemaVersion'")
    else:
        info["schemaVersion"] = flow_data["schemaVersion"]
    
    # Check trigger
    if "trigger" not in flow_data:
        issues.append("Missing 'trigger' field")
        return {"issues": issues, "warnings": warnings, "info": info}
    
    trigger = flow_data["trigger"]
    info["trigger_type"] = trigger.get("type", "UNKNOWN")
    
    # Check trigger required fields
    required_trigger_fields = ["name", "valid", "displayName", "type"]
    for field in required_trigger_fields:
        if field not in trigger:
            issues.append(f"Trigger missing required field: '{field}'")
    
    # Check trigger settings
    if "settings" in trigger:
        settings = trigger["settings"]
        
        if trigger.get("type") == "PIECE_TRIGGER":
            if "pieceName" not in settings:
                issues.append("Trigger settings missing 'pieceName'")
            if "pieceVersion" not in settings:
                issues.append("Trigger settings missing 'pieceVersion'")
            if "input" not in settings:
                warnings.append("Trigger settings missing 'input' (should be {} if empty)")
            if "propertySettings" not in settings:
                warnings.append("Trigger settings missing 'propertySettings'")
    
    # Check actions recursively
    def check_action(action: Any, path: str = "trigger.nextAction", depth: int = 0):
        if action is None:
            return
        
        if depth > 20:  # Prevent infinite recursion
            return
        
        action_type = action.get("type", "UNKNOWN")
        
        # Check required fields
        required_action_fields = ["name", "valid", "displayName", "type"]
        for field in required_action_fields:
            if field not in action:
                issues.append(f"{path} missing required field: '{field}'")
        
        # Check settings
        if "settings" not in action:
            issues.append(f"{path} missing 'settings'")
        else:
            settings = action["settings"]
            
            if action_type == "PIECE":
                if "pieceName" not in settings:
                    issues.append(f"{path} settings missing 'pieceName'")
                if "actionName" not in settings:
                    issues.append(f"{path} settings missing 'actionName'")
                if "pieceVersion" not in settings:
                    issues.append(f"{path} settings missing 'pieceVersion'")
                if "input" not in settings:
                    warnings.append(f"{path} settings missing 'input'")
                if "propertySettings" not in settings:
                    warnings.append(f"{path} settings missing 'propertySettings'")
            
            elif action_type == "CODE":
                if "sourceCode" not in settings:
                    issues.append(f"{path} settings missing 'sourceCode'")
                if "input" not in settings:
                    warnings.append(f"{path} settings missing 'input'")
            
            elif action_type == "ROUTER":
                if "branches" not in settings:
                    issues.append(f"{path} settings missing 'branches'")
                if "children" not in action:
                    issues.append(f"{path} missing 'children' array")
                else:
                    children = action["children"]
                    branches = settings.get("branches", [])
                    if len(children) != len(branches):
                        warnings.append(f"{path} children length ({len(children)}) != branches length ({len(branches)})")
        
        # Check nextAction
        if "nextAction" in action:
            check_action(action["nextAction"], f"{path}.nextAction", depth + 1)
        
        # Check children for ROUTER
        if "children" in action:
            for i, child in enumerate(action["children"]):
                if child is not None:
                    check_action(child, f"{path}.children[{i}]", depth + 1)
    
    if "nextAction" in trigger:
        check_action(trigger["nextAction"])
    
    return {
        "issues": issues,
        "warnings": warnings,
        "info": info
    }

def main():
    training_file = "/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system (1).json"
    
    print("=" * 80)
    print("SCHEMA COMPATIBILITY ANALYSIS")
    print("=" * 80)
    print(f"\nReading training data from: {training_file}\n")
    
    try:
        with open(training_file, 'r', encoding='utf-8') as f:
            training_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: File not found: {training_file}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)
    
    total_entries = len(training_data)
    print(f"Total entries: {total_entries}\n")
    
    # Analyze first 100 entries (or all if less)
    sample_size = min(100, total_entries)
    print(f"Analyzing first {sample_size} entries...\n")
    
    all_issues = []
    all_warnings = []
    schema_versions = {}
    has_displayName_count = 0
    has_name_count = 0
    trigger_types = {}
    action_types = set()
    
    for i, entry in enumerate(training_data[:sample_size]):
        try:
            flow_json = json.loads(entry["output"])
            result = analyze_flow_schema(flow_json, i)
            
            all_issues.extend(result["issues"])
            all_warnings.extend(result["warnings"])
            
            info = result["info"]
            if info.get("has_displayName"):
                has_displayName_count += 1
            if info.get("has_name"):
                has_name_count += 1
            
            schema_ver = info.get("schemaVersion", "MISSING")
            schema_versions[schema_ver] = schema_versions.get(schema_ver, 0) + 1
            
            trigger_type = info.get("trigger_type", "UNKNOWN")
            trigger_types[trigger_type] = trigger_types.get(trigger_type, 0) + 1
            
        except json.JSONDecodeError as e:
            all_issues.append(f"Entry {i}: Invalid JSON in output: {e}")
        except Exception as e:
            all_issues.append(f"Entry {i}: Error analyzing: {e}")
    
    # Print summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    print(f"\n✅ Entries with 'displayName': {has_displayName_count}/{sample_size} ({has_displayName_count/sample_size*100:.1f}%)")
    print(f"⚠️  Entries with 'name' field: {has_name_count}/{sample_size} ({has_name_count/sample_size*100:.1f}%)")
    
    print(f"\n📊 Schema Versions:")
    for ver, count in sorted(schema_versions.items()):
        pct = count / sample_size * 100
        print(f"   {ver}: {count} ({pct:.1f}%)")
    
    print(f"\n📊 Trigger Types:")
    for ttype, count in sorted(trigger_types.items()):
        pct = count / sample_size * 100
        print(f"   {ttype}: {count} ({pct:.1f}%)")
    
    # Count unique issues/warnings
    unique_issues = {}
    for issue in all_issues:
        unique_issues[issue] = unique_issues.get(issue, 0) + 1
    
    unique_warnings = {}
    for warning in all_warnings:
        unique_warnings[warning] = unique_warnings.get(warning, 0) + 1
    
    print(f"\n❌ Critical Issues Found: {len(unique_issues)} unique types")
    if unique_issues:
        print("\n   Top issues:")
        for issue, count in sorted(unique_issues.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"   - {issue}: {count} occurrences")
    
    print(f"\n⚠️  Warnings Found: {len(unique_warnings)} unique types")
    if unique_warnings:
        print("\n   Top warnings:")
        for warning, count in sorted(unique_warnings.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"   - {warning}: {count} occurrences")
    
    # Compare with example flows
    print("\n" + "=" * 80)
    print("COMPARISON WITH EXAMPLE FLOWS")
    print("=" * 80)
    
    example_flows_dir = Path("example_flows")
    if example_flows_dir.exists():
        example_files = list(example_flows_dir.glob("*.json"))
        example_files = [f for f in example_files if not f.name.endswith("Zone.Identifier")]
        
        print(f"\nFound {len(example_files)} example flow files")
        
        example_schema_versions = {}
        example_has_displayName = 0
        
        for example_file in example_files:
            try:
                with open(example_file, 'r', encoding='utf-8-sig') as f:
                    example_data = json.load(f)
                
                template = example_data.get("template", {})
                if "displayName" in template:
                    example_has_displayName += 1
                
                schema_ver = template.get("schemaVersion", "MISSING")
                example_schema_versions[schema_ver] = example_schema_versions.get(schema_ver, 0) + 1
            except Exception as e:
                print(f"   ⚠️  Error reading {example_file.name}: {e}")
        
        print(f"\n✅ Example flows with 'displayName': {example_has_displayName}/{len(example_files)}")
        print(f"\n📊 Example flow schema versions:")
        for ver, count in sorted(example_schema_versions.items()):
            print(f"   {ver}: {count}")
        
        # Schema version mismatch
        training_ver = max(schema_versions.keys(), key=lambda x: schema_versions.get(x, 0)) if schema_versions else "UNKNOWN"
        example_ver = max(example_schema_versions.keys(), key=lambda x: example_schema_versions.get(x, 0)) if example_schema_versions else "UNKNOWN"
        
        if training_ver != example_ver:
            print(f"\n⚠️  SCHEMA VERSION MISMATCH:")
            print(f"   Training data mostly uses: {training_ver}")
            print(f"   Example flows use: {example_ver}")
            print(f"   This may cause compatibility issues!")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    if "MISSING" in schema_versions:
        print("\n1. ⚠️  Many flows missing 'schemaVersion' - should add this")
    
    if has_name_count > 0:
        print("\n2. ⚠️  Some flows have 'name' field - should use 'displayName' only")
    
    if len(unique_issues) > 0:
        print(f"\n3. ❌ Found {len(unique_issues)} types of critical issues - need to fix these")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()

