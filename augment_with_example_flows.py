#!/usr/bin/env python3
"""Augment training set with example flows converted to training format."""

import json
import sys
from pathlib import Path

def augment_training_set(original_path, examples_path, output_path=None):
    """Add example flow examples to training set."""
    
    # Read original training set
    print(f"Reading original training set from: {original_path}")
    try:
        with open(original_path, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: File not found: {original_path}")
        sys.exit(1)
    
    original_count = len(original_data)
    print(f"  Found {original_count} entries")
    
    # Read example flow training entries
    print(f"\nReading example flow training entries from: {examples_path}")
    try:
        with open(examples_path, 'r', encoding='utf-8') as f:
            example_entries = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: File not found: {examples_path}")
        print(f"   Run 'python3 convert_example_flows_to_training.py' first to generate this file.")
        sys.exit(1)
    
    example_count = len(example_entries)
    print(f"  Found {example_count} example flow entries")
    
    # Check for duplicates (by instruction and output)
    existing_instructions = {entry.get('instruction', '').lower().strip() for entry in original_data}
    existing_outputs = {entry.get('output', '').strip() for entry in original_data}
    
    new_examples = []
    duplicates = 0
    
    for example in example_entries:
        instruction = example.get('instruction', '').lower().strip()
        output = example.get('output', '').strip()
        
        # Check both instruction and output to avoid duplicates
        if instruction not in existing_instructions and output not in existing_outputs:
            new_examples.append(example)
        else:
            duplicates += 1
            print(f"  ⚠️  Skipping duplicate: {example.get('instruction', '')[:60]}...")
    
    if duplicates > 0:
        print(f"\n  Skipped {duplicates} duplicate(s)")
    
    if len(new_examples) == 0:
        print("\n⚠️  No new examples to add (all are duplicates)")
        return 0
    
    # Merge
    print(f"\nMerging {len(new_examples)} new examples...")
    augmented_data = original_data + new_examples
    
    # Determine output path
    if output_path is None:
        # Use the same filename but with _augmented suffix
        base_path = Path(original_path)
        output_path = str(base_path.parent / f"{base_path.stem}_augmented{base_path.suffix}")
    
    # Create backup
    backup_path = original_path.replace('.json', '_backup.json')
    print(f"\nCreating backup: {backup_path}")
    try:
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(original_data, f, indent=2, ensure_ascii=False)
        print(f"  ✅ Backup created")
    except Exception as e:
        print(f"  ⚠️  Warning: Could not create backup: {e}")
    
    # Write augmented file
    print(f"\nWriting augmented training set to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(augmented_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Success!")
    print(f"  Original entries: {original_count}")
    print(f"  New entries: {len(new_examples)}")
    print(f"  Total entries: {len(augmented_data)}")
    print(f"  Increase: +{len(new_examples)} ({len(new_examples)/original_count*100:.1f}%)")
    print(f"\n📁 Output saved to: {output_path}")
    
    return len(new_examples)

if __name__ == '__main__':
    # Default paths
    original_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system (1).json'
    examples_path = 'example_flows_training_entries.json'
    
    # Allow override via command line
    if len(sys.argv) > 1:
        original_path = sys.argv[1]
    if len(sys.argv) > 2:
        examples_path = sys.argv[2]
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        output_path = None
    
    try:
        new_count = augment_training_set(original_path, examples_path, output_path)
        if new_count > 0:
            print(f"\n🎉 Training set augmented successfully!")
            print(f"   Added {new_count} new example flow entries")
        else:
            print(f"\n⚠️  No new entries were added (all duplicates)")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

