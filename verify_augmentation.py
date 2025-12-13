#!/usr/bin/env python3
"""Verify augmentation was successful."""

import json

file_path = '/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total entries: {len(data)}")

router_count = sum(1 for e in data if 'ROUTER' in e.get('output', ''))
print(f"ROUTER examples: {router_count}")

print("\nLast 3 entries (should be the new ones):")
for i, entry in enumerate(data[-3:], start=len(data)-2):
    instruction = entry.get('instruction', '')[:70]
    has_router = 'ROUTER' in entry.get('output', '')
    print(f"  {i}. {instruction}...")
    print(f"     Has ROUTER: {'✅' if has_router else '❌'}")

print("\n✅ Augmentation complete!")

