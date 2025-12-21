#!/usr/bin/env python3
"""
Process model outputs from a text file.

Usage:
  1. Save your raw outputs to raw_outputs.txt (one JSON per line, or separated by --- TEST N ---)
  2. Run: python3 process_from_file.py raw_outputs.txt
"""
import json
import re
import sys
from pathlib import Path
from postprocessor_v2 import postprocess

OUTPUT_DIR = Path(__file__).parent / "generated_templates"
OUTPUT_DIR.mkdir(exist_ok=True)

def fix_json(raw: str) -> str:
    """Fix common JSON issues."""
    # Remove markdown
    if "```json" in raw:
        m = re.search(r'```json\s*(.*?)\s*```', raw, re.DOTALL)
        if m: raw = m.group(1)
    elif "```" in raw:
        m = re.search(r'```\s*(.*?)\s*```', raw, re.DOTALL)
        if m: raw = m.group(1)
    
    # Fix piece names
    raw = re.sub(r'activepieces-piee-', '@activepieces/piece-', raw)
    raw = re.sub(r'activepieces-piece-', '@activepieces/piece-', raw)
    raw = re.sub(r'activepieces-official[/-]', '@activepieces/piece-', raw)
    raw = re.sub(r'"activepieces/', '"@activepieces/piece-', raw)
    
    # Remove control chars except in proper escapes
    # Replace actual newlines/tabs with escaped versions
    lines = raw.split('\n')
    if len(lines) == 1:
        # Single line - good
        pass
    else:
        # Multi-line - likely the JSON spans multiple lines which is ok
        raw = '\n'.join(lines)
    
    return raw.strip()

def extract_json(text: str) -> str:
    """Extract JSON from text, handling markdown and extra content."""
    text = text.strip()
    
    # Remove markdown code blocks
    if "```json" in text:
        m = re.search(r'```json\s*([\s\S]*?)\s*```', text)
        if m:
            text = m.group(1)
    elif "```" in text:
        m = re.search(r'```\s*([\s\S]*?)\s*```', text)
        if m:
            text = m.group(1)
    
    # Find JSON object
    text = text.strip()
    if text.startswith('{'):
        # Find matching closing brace
        depth = 0
        in_string = False
        escape = False
        for i, c in enumerate(text):
            if escape:
                escape = False
                continue
            if c == '\\':
                escape = True
                continue
            if c == '"' and not escape:
                in_string = not in_string
                continue
            if not in_string:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        return text[:i+1]
    return text

def process_single(raw: str, test_num: int) -> dict:
    """Process a single output."""
    fixed = fix_json(raw)
    json_str = extract_json(fixed)
    template = postprocess(json_str)
    
    # Save
    filename = OUTPUT_DIR / f"test_{test_num:02d}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(template, f, indent=2, ensure_ascii=False)
    
    return {
        "file": str(filename),
        "pieces": template.get("pieces", []),
        "trigger": template.get("template", {}).get("trigger", {}).get("settings", {}).get("triggerName", "N/A")
    }

def parse_test_file(content: str) -> list:
    """Parse test file content into individual tests."""
    tests = []
    
    # Try splitting by --- TEST N ---
    if re.search(r'---\s*TEST\s+\d+\s*---', content):
        parts = re.split(r'---\s*TEST\s+\d+\s*---', content)
        for part in parts[1:]:  # Skip first empty part
            part = part.strip()
            if part:
                tests.append(part)
    else:
        # Try line by line (each line is a JSON)
        for line in content.strip().split('\n'):
            line = line.strip()
            if line and line.startswith('{'):
                tests.append(line)
    
    return tests

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_from_file.py <input_file>")
        print("\nInput file format:")
        print("  - One JSON per line, OR")
        print("  - Tests separated by '--- TEST N ---' markers")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)
    
    content = input_file.read_text(encoding='utf-8')
    tests = parse_test_file(content)
    
    print(f"Found {len(tests)} tests in {input_file}\n")
    
    passed = 0
    failed = 0
    errors = []
    
    for i, raw in enumerate(tests, 1):
        print(f"--- TEST {i} ---")
        try:
            result = process_single(raw, i)
            print(f"✅ PASSED")
            print(f"   Trigger: {result['trigger']}")
            print(f"   Pieces: {result['pieces']}")
            passed += 1
        except Exception as e:
            print(f"❌ FAILED: {e}")
            errors.append((i, str(e), raw[:100]))
            failed += 1
        print()
    
    print("="*70)
    print(f"SUMMARY: {passed} passed, {failed} failed out of {len(tests)}")
    print(f"Templates saved to: {OUTPUT_DIR}")
    
    if errors:
        print("\n--- ERRORS ---")
        for test_num, err, preview in errors:
            print(f"Test {test_num}: {err}")
            print(f"  Preview: {preview}...")

if __name__ == "__main__":
    main()

