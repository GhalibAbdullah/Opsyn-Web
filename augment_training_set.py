#!/usr/bin/env python3
"""Augment training set with generated conditional examples."""

import json
import sys
from pathlib import Path

def augment_training_set(original_path, examples_path, output_path=None):
    """Add generated examples to training set."""
    
    # Read original training set
    print(f"Reading original training set from: {original_path}")
    with open(original_path, 'r', encoding='utf-8') as f:
        original_data = json.load(f)
    
    original_count = len(original_data)
    print(f"  Found {original_count} entries")
    
    # Read generated examples
    print(f"\nReading generated examples from: {examples_path}")
    with open(examples_path, 'r', encoding='utf-8') as f:
        generated_examples = json.load(f)
    
    generated_count = len(generated_examples)
    print(f"  Found {generated_count} examples to add")
    
    # Check for duplicates (by instruction)
    existing_instructions = {entry.get('instruction', '').lower().strip() for entry in original_data}
    new_examples = []
    duplicates = 0
    
    for example in generated_examples:
        instruction = example.get('instruction', '').lower().strip()
        if instruction not in existing_instructions:
            new_examples.append(example)
        else:
            duplicates += 1
            print(f"  ⚠️  Skipping duplicate: {example.get('instruction', '')[:50]}...")
    
    if duplicates > 0:
        print(f"\n  Skipped {duplicates} duplicate(s)")
    
    # Merge
    print(f"\nMerging {len(new_examples)} new examples...")
    augmented_data = original_data + new_examples
    
    # Determine output path
    if output_path is None:
        # Create backup and augment original
        backup_path = original_path.replace('.json', '_backup.json')
        output_path = original_path
    
        # Create backup
        print(f"\nCreating backup: {backup_path}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(original_data, f, indent=2, ensure_ascii=False)
        print(f"  ✅ Backup created")
    
    # Write augmented file
    print(f"\nWriting augmented training set to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(augmented_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Success!")
    print(f"  Original entries: {original_count}")
    print(f"  New entries: {len(new_examples)}")
    print(f"  Total entries: {len(augmented_data)}")
    print(f"  Increase: +{len(new_examples)} ({len(new_examples)/original_count*100:.1f}%)")
    
    return len(new_examples)

if __name__ == '__main__':
    original_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system.json'
    examples_path = 'conditional_training_examples.json'
    
    # Optional: output to new file instead of overwriting
    import sys
    if len(sys.argv) > 1:
        output_path = sys.argv[1]
    else:
        output_path = None  # Will backup and overwrite original
    
    try:
        new_count = augment_training_set(original_path, examples_path, output_path)
        print(f"\n🎉 Training set augmented successfully!")
        print(f"   Added {new_count} new conditional examples")
    except FileNotFoundError as e:
        print(f"❌ Error: File not found: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

