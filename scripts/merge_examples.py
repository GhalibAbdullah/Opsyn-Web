#!/usr/bin/env python3
"""Merge generated examples into training set."""

import json
import sys

def merge_examples(original_path, new_examples_path, output_path=None):
    """Merge new examples into training set."""
    
    # Read original training set
    print(f"Reading original training set: {original_path}")
    with open(original_path, 'r', encoding='utf-8') as f:
        original_data = json.load(f)
    
    original_count = len(original_data)
    print(f"  Found {original_count} entries")
    
    # Read new examples
    print(f"\nReading new examples: {new_examples_path}")
    with open(new_examples_path, 'r', encoding='utf-8') as f:
        new_examples = json.load(f)
    
    new_count = len(new_examples)
    print(f"  Found {new_count} examples to add")
    
    # Check for duplicates (by instruction)
    existing_instructions = {entry.get('instruction', '').lower().strip() for entry in original_data}
    unique_new = []
    duplicates = 0
    
    for example in new_examples:
        instruction = example.get('instruction', '').lower().strip()
        if instruction not in existing_instructions:
            unique_new.append(example)
            existing_instructions.add(instruction)  # Prevent duplicates within new examples
        else:
            duplicates += 1
    
    if duplicates > 0:
        print(f"  ⚠️  Skipped {duplicates} duplicate(s)")
    
    # Merge
    print(f"\nMerging {len(unique_new)} unique new examples...")
    merged_data = original_data + unique_new
    
    # Determine output path
    if output_path is None:
        # Create backup and merge into original
        backup_path = original_path.replace('.json', '_backup.json')
        output_path = original_path
        
        # Create backup
        print(f"\nCreating backup: {backup_path}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(original_data, f, indent=2, ensure_ascii=False)
        print(f"  ✅ Backup created")
    
    # Write merged file
    print(f"\nWriting merged training set: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Success!")
    print(f"  Original entries: {original_count}")
    print(f"  New entries added: {len(unique_new)}")
    print(f"  Duplicates skipped: {duplicates}")
    print(f"  Total entries: {len(merged_data)}")
    print(f"  Increase: +{len(unique_new)} ({len(unique_new)/original_count*100:.1f}%)")
    
    return len(unique_new)

if __name__ == '__main__':
    original_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system.json'
    new_examples_path = 'many_training_examples.json'
    
    # Optional: output to new file instead of overwriting
    if len(sys.argv) > 1:
        output_path = sys.argv[1]
    else:
        output_path = None  # Will backup and overwrite original
    
    try:
        new_count = merge_examples(original_path, new_examples_path, output_path)
        print(f"\n🎉 Training set augmented successfully!")
        print(f"   Added {new_count} new examples")
    except FileNotFoundError as e:
        print(f"❌ Error: File not found: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

