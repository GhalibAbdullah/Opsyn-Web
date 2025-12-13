import json

with open('/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system (1).json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entry = data[0]
flow = json.loads(entry['output'])

print('Sample Training Entry Structure:')
print(f'  displayName: {flow.get("displayName", "MISSING")}')
print(f'  schemaVersion: {flow.get("schemaVersion", "MISSING")}')
print(f'  trigger.type: {flow["trigger"].get("type", "MISSING")}')
print(f'  trigger.settings has pieceName: {"pieceName" in flow["trigger"].get("settings", {})}')
print(f'  trigger.settings has propertySettings: {"propertySettings" in flow["trigger"].get("settings", {})}')

