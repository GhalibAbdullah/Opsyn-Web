#!/usr/bin/env python3
"""Show the location of the augmented training set file."""

import os
import json

file_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system.json'
windows_path = r'C:\Users\comps\Downloads\opsyn_alpaca_merged_v5_system.json'

print("=" * 70)
print("AUGMENTED TRAINING SET FILE LOCATION")
print("=" * 70)
print()
print("Windows Path:")
print(f"  {windows_path}")
print()
print("WSL/Linux Path:")
print(f"  {file_path}")
print()

if os.path.exists(file_path):
    file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("✅ File exists!")
    print(f"  Size: {file_size:.2f} MB")
    print(f"  Total entries: {len(data)}")
    print()
    print("To open in Windows:")
    print(f"  {windows_path}")
    print()
    print("To open in WSL:")
    print(f"  {file_path}")
else:
    print("❌ File not found at expected location")
    print(f"  Checked: {file_path}")

