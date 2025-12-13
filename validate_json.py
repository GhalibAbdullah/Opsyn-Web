#!/usr/bin/env python3
"""
JSON Validator for Model Outputs

Step 0 of the pipeline: Validates and cleans JSON before post-processing.
Handles common model output issues like:
- Truncated JSON
- Extra characters
- Markdown code blocks
- Multiple JSON objects
"""

import json
import re
import sys
from typing import Tuple, Optional


def extract_json(content: str) -> Tuple[Optional[str], str]:
    """
    Extract valid JSON from potentially malformed content.
    
    Returns:
        Tuple of (extracted_json_string or None, error_message)
    """
    content = content.strip()
    
    # Handle empty content
    if not content:
        return None, "Empty content"
    
    # Remove markdown code blocks
    if "```json" in content:
        match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            content = match.group(1).strip()
    elif "```" in content:
        match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            content = match.group(1).strip()
    
    # Find JSON object start
    start_idx = content.find("{")
    if start_idx == -1:
        return None, "No JSON object found (no opening brace)"
    
    # Extract from start
    content = content[start_idx:]
    
    # Try to find balanced braces
    brace_count = 0
    end_idx = -1
    in_string = False
    escape_next = False
    
    for i, char in enumerate(content):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        
        if in_string:
            continue
        
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i
                break
    
    if end_idx == -1:
        # Truncated JSON - try to repair by adding closing braces
        repair_braces = "}" * brace_count
        content = content + repair_braces
        return content, f"Warning: JSON was truncated, added {brace_count} closing braces"
    
    # Extract just the balanced JSON
    json_str = content[:end_idx + 1]
    
    # Validate it parses
    try:
        json.loads(json_str)
        return json_str, "OK"
    except json.JSONDecodeError as e:
        return None, f"JSON parse error: {e}"


def validate_and_save(input_path: str, output_path: str) -> bool:
    """
    Validate JSON from input file and save cleaned version.
    
    Returns:
        True if successful, False otherwise
    """
    # Read input
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ File not found: {input_path}")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False
    
    # Extract JSON
    json_str, message = extract_json(content)
    
    if json_str is None:
        print(f"❌ Invalid JSON: {message}")
        return False
    
    if message != "OK":
        print(f"⚠️  {message}")
    
    # Parse and pretty-print
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error after extraction: {e}")
        return False
    
    # Save validated JSON
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ Valid JSON saved to: {output_path}")
        return True
    except Exception as e:
        print(f"❌ Error writing file: {e}")
        return False


def main():
    if len(sys.argv) < 3:
        print("Usage: python validate_json.py <input_file> <output_file>")
        print("")
        print("Validates and cleans JSON from model output.")
        print("This is Step 0 of the pipeline, before robust post-processing.")
        print("")
        print("Full pipeline:")
        print("  1. python validate_json.py raw_output.txt validated.json")
        print("  2. python robust_post_processor.py validated.json processed.json")
        print("  3. python flow_template_converter.py processed.json template.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    success = validate_and_save(input_file, output_file)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

