#!/usr/bin/env python3
"""Validate the training set for Activepieces flow schema compatibility."""

import json
import sys
from typing import Dict, List, Any

def validate_flow_structure(flow_data: Dict[str, Any], entry_index: int) -> List[str]:
    """Validate a single flow structure and return list of errors."""
    errors = []
    
    # Check required top-level fields
    required_fields = ['displayName', 'trigger', 'schemaVersion']
    for field in required_fields:
        if field not in flow_data:
            errors.append(f"Entry {entry_index}: Missing required field '{field}'")
    
    if 'trigger' not in flow_data:
        return errors  # Can't validate trigger if it doesn't exist
    
    trigger = flow_data['trigger']
    
    # Validate trigger structure
    trigger_required = ['name', 'type', 'valid', 'displayName', 'settings']
    for field in trigger_required:
        if field not in trigger:
            errors.append(f"Entry {entry_index}: Trigger missing required field '{field}'")
    
    if 'type' in trigger:
        if trigger['type'] not in ['EMPTY', 'PIECE_TRIGGER']:
            errors.append(f"Entry {entry_index}: Invalid trigger type '{trigger['type']}'")
    
    if 'settings' in trigger and trigger.get('type') == 'PIECE_TRIGGER':
        settings = trigger['settings']
        piece_required = ['pieceName', 'pieceVersion', 'input', 'propertySettings']
        for field in piece_required:
            if field not in settings:
                errors.append(f"Entry {entry_index}: Trigger settings missing '{field}'")
    
    # Validate action chain if present
    if 'nextAction' in trigger:
        validate_action(trigger['nextAction'], entry_index, errors, "trigger.nextAction")
    
    return errors

def validate_action(action: Any, entry_index: int, errors: List[str], path: str):
    """Recursively validate an action."""
    if action is None:
        return
    
    if not isinstance(action, dict):
        errors.append(f"Entry {entry_index}: {path} is not an object")
        return
    
    required_fields = ['name', 'type', 'valid', 'displayName']
    for field in required_fields:
        if field not in action:
            errors.append(f"Entry {entry_index}: {path} missing required field '{field}'")
    
    if 'type' in action:
        valid_types = ['PIECE', 'CODE', 'LOOP_ON_ITEMS', 'ROUTER']
        if action['type'] not in valid_types:
            errors.append(f"Entry {entry_index}: {path} has invalid type '{action['type']}'")
    
    if 'settings' in action:
        settings = action['settings']
        if action.get('type') == 'PIECE':
            piece_required = ['pieceName', 'pieceVersion', 'input', 'propertySettings']
            for field in piece_required:
                if field not in settings:
                    errors.append(f"Entry {entry_index}: {path}.settings missing '{field}'")
        elif action.get('type') == 'CODE':
            if 'sourceCode' not in settings:
                errors.append(f"Entry {entry_index}: {path}.settings missing 'sourceCode'")
            elif 'code' not in settings.get('sourceCode', {}):
                errors.append(f"Entry {entry_index}: {path}.settings.sourceCode missing 'code'")
        elif action.get('type') == 'LOOP_ON_ITEMS':
            if 'items' not in settings:
                errors.append(f"Entry {entry_index}: {path}.settings missing 'items'")
        elif action.get('type') == 'ROUTER':
            if 'branches' not in settings:
                errors.append(f"Entry {entry_index}: {path}.settings missing 'branches'")
            if 'children' not in action:
                errors.append(f"Entry {entry_index}: {path} missing 'children' array")
            elif 'branches' in settings and 'children' in action:
                if len(settings['branches']) != len(action['children']):
                    errors.append(f"Entry {entry_index}: {path} branches length ({len(settings['branches'])}) != children length ({len(action['children'])})")
    
    # Recursively validate nested actions
    if 'nextAction' in action:
        validate_action(action['nextAction'], entry_index, errors, f"{path}.nextAction")
    
    if 'firstLoopAction' in action:
        validate_action(action['firstLoopAction'], entry_index, errors, f"{path}.firstLoopAction")
    
    if 'children' in action and isinstance(action['children'], list):
        for i, child in enumerate(action['children']):
            if child is not None:
                validate_action(child, entry_index, errors, f"{path}.children[{i}]")

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = r'C:\Users\comps\Downloads\opsyn_alpaca_merged_v5_system.json'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Total entries: {len(data)}")
        print(f"Dataset structure: {list(data[0].keys())}")
        print("\nValidating entries...\n")
        
        total_errors = []
        valid_count = 0
        invalid_json_count = 0
        
        for i, entry in enumerate(data):
            try:
                # Parse the output JSON string
                flow_data = json.loads(entry['output'])
                
                # Validate the structure
                errors = validate_flow_structure(flow_data, i)
                
                if errors:
                    total_errors.extend(errors)
                else:
                    valid_count += 1
                    
            except json.JSONDecodeError as e:
                invalid_json_count += 1
                total_errors.append(f"Entry {i}: Invalid JSON in output - {str(e)}")
            except Exception as e:
                total_errors.append(f"Entry {i}: Unexpected error - {str(e)}")
        
        print(f"\n=== Validation Results ===")
        print(f"Valid entries: {valid_count}/{len(data)}")
        print(f"Invalid JSON: {invalid_json_count}")
        print(f"Total errors: {len(total_errors)}")
        
        if total_errors:
            print(f"\n=== First 20 Errors ===")
            for error in total_errors[:20]:
                print(error)
            if len(total_errors) > 20:
                print(f"\n... and {len(total_errors) - 20} more errors")
        else:
            print("\n✅ All entries are valid!")
        
        # Check schema version distribution
        print(f"\n=== Schema Version Distribution ===")
        schema_versions = {}
        for entry in data:
            try:
                flow_data = json.loads(entry['output'])
                version = flow_data.get('schemaVersion', 'missing')
                schema_versions[version] = schema_versions.get(version, 0) + 1
            except:
                pass
        for version, count in sorted(schema_versions.items()):
            print(f"  {version}: {count}")
        
        return 0 if len(total_errors) == 0 else 1
        
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return 1
    except Exception as e:
        print(f"Error: {str(e)}")
        return 1

if __name__ == '__main__':
    sys.exit(main())

