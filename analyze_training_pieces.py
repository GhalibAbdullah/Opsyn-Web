#!/usr/bin/env python3
"""
Analyze training data to find the most commonly used pieces.
This helps prioritize which pieces to handle in the post-processor.
"""

import json
import re
from collections import Counter
from typing import Dict, List, Any, Set

def extract_pieces_from_flow(flow_data: Dict[str, Any]) -> List[str]:
    """Extract all piece names from a flow."""
    pieces = []
    
    def extract_from_settings(settings: Dict[str, Any]):
        if "pieceName" in settings:
            pieces.append(settings["pieceName"])
    
    def extract_from_action(action: Dict[str, Any]):
        if action is None:
            return
        if "settings" in action:
            extract_from_settings(action["settings"])
        if "nextAction" in action:
            extract_from_action(action["nextAction"])
        if "children" in action:
            for child in action.get("children", []):
                if child:
                    extract_from_action(child)
        if "firstLoopAction" in action:
            extract_from_action(action["firstLoopAction"])
    
    # Extract from trigger
    trigger = flow_data.get("trigger", {})
    if "settings" in trigger:
        extract_from_settings(trigger["settings"])
    if "nextAction" in trigger:
        extract_from_action(trigger["nextAction"])
    
    return pieces

def extract_trigger_names(flow_data: Dict[str, Any]) -> List[tuple]:
    """Extract (pieceName, triggerName) pairs from a flow."""
    trigger_pairs = []
    
    trigger = flow_data.get("trigger", {})
    settings = trigger.get("settings", {})
    
    if "pieceName" in settings and "triggerName" in settings:
        trigger_pairs.append((settings["pieceName"], settings["triggerName"]))
    
    return trigger_pairs

def extract_action_names(flow_data: Dict[str, Any]) -> List[tuple]:
    """Extract (pieceName, actionName) pairs from a flow."""
    action_pairs = []
    
    def extract_from_action(action: Dict[str, Any]):
        if action is None:
            return
        settings = action.get("settings", {})
        if "pieceName" in settings and "actionName" in settings:
            action_pairs.append((settings["pieceName"], settings["actionName"]))
        if "nextAction" in action:
            extract_from_action(action["nextAction"])
        if "children" in action:
            for child in action.get("children", []):
                if child:
                    extract_from_action(child)
        if "firstLoopAction" in action:
            extract_from_action(action["firstLoopAction"])
    
    trigger = flow_data.get("trigger", {})
    if "nextAction" in trigger:
        extract_from_action(trigger["nextAction"])
    
    return action_pairs

def extract_field_names(flow_data: Dict[str, Any]) -> Dict[str, Set[str]]:
    """Extract field names used in each piece."""
    piece_fields: Dict[str, Set[str]] = {}
    
    def extract_from_settings(settings: Dict[str, Any]):
        piece_name = settings.get("pieceName", "")
        input_data = settings.get("input", {})
        
        if piece_name and input_data:
            if piece_name not in piece_fields:
                piece_fields[piece_name] = set()
            piece_fields[piece_name].update(input_data.keys())
    
    def extract_from_action(action: Dict[str, Any]):
        if action is None:
            return
        if "settings" in action:
            extract_from_settings(action["settings"])
        if "nextAction" in action:
            extract_from_action(action["nextAction"])
        if "children" in action:
            for child in action.get("children", []):
                if child:
                    extract_from_action(child)
        if "firstLoopAction" in action:
            extract_from_action(action["firstLoopAction"])
    
    # Extract from trigger
    trigger = flow_data.get("trigger", {})
    if "settings" in trigger:
        extract_from_settings(trigger["settings"])
    if "nextAction" in trigger:
        extract_from_action(trigger["nextAction"])
    
    return piece_fields

def analyze_training_file(file_path: str) -> Dict[str, Any]:
    """Analyze training data file."""
    print(f"Reading training data from: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)
    
    print(f"Total entries: {len(data)}")
    
    all_pieces = []
    all_triggers = []
    all_actions = []
    all_fields: Dict[str, Set[str]] = {}
    
    for i, entry in enumerate(data):
        output_str = entry.get("output", "")
        
        # Try to parse the output as JSON
        try:
            # Handle potential JSON in markdown code blocks
            if "```json" in output_str:
                match = re.search(r'```json\s*(.*?)\s*```', output_str, re.DOTALL)
                if match:
                    output_str = match.group(1)
            elif "```" in output_str:
                match = re.search(r'```\s*(.*?)\s*```', output_str, re.DOTALL)
                if match:
                    output_str = match.group(1)
            
            flow = json.loads(output_str)
            
            # Extract pieces
            pieces = extract_pieces_from_flow(flow)
            all_pieces.extend(pieces)
            
            # Extract triggers
            triggers = extract_trigger_names(flow)
            all_triggers.extend(triggers)
            
            # Extract actions
            actions = extract_action_names(flow)
            all_actions.extend(actions)
            
            # Extract fields
            fields = extract_field_names(flow)
            for piece, field_set in fields.items():
                if piece not in all_fields:
                    all_fields[piece] = set()
                all_fields[piece].update(field_set)
        
        except json.JSONDecodeError:
            continue
    
    # Count frequencies
    piece_counts = Counter(all_pieces)
    trigger_counts = Counter(all_triggers)
    action_counts = Counter(all_actions)
    
    return {
        "total_entries": len(data),
        "piece_counts": piece_counts.most_common(20),
        "trigger_counts": trigger_counts.most_common(20),
        "action_counts": action_counts.most_common(20),
        "piece_fields": {k: list(v) for k, v in all_fields.items()},
    }

def main():
    import sys
    
    # Try different training data locations
    training_files = [
        "/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system (1).json",
        "example_flows_training_entries.json",
    ]
    
    results = {}
    
    for file_path in training_files:
        try:
            result = analyze_training_file(file_path)
            results[file_path] = result
            
            print(f"\n{'='*60}")
            print(f"Analysis for: {file_path}")
            print('='*60)
            
            print(f"\nTop 20 Pieces:")
            for piece, count in result["piece_counts"]:
                print(f"  {count:4d} - {piece}")
            
            print(f"\nTop 20 Triggers (piece, triggerName):")
            for (piece, trigger), count in result["trigger_counts"]:
                short_piece = piece.split("/")[-1] if "/" in piece else piece
                print(f"  {count:4d} - {short_piece}: {trigger}")
            
            print(f"\nTop 20 Actions (piece, actionName):")
            for (piece, action), count in result["action_counts"]:
                short_piece = piece.split("/")[-1] if "/" in piece else piece
                print(f"  {count:4d} - {short_piece}: {action}")
            
            print(f"\nField names by piece (top 10 pieces):")
            piece_field_items = list(result["piece_fields"].items())
            for piece, fields in piece_field_items[:10]:
                short_piece = piece.split("/")[-1] if "/" in piece else piece
                print(f"  {short_piece}: {', '.join(sorted(fields)[:10])}")
        
        except FileNotFoundError:
            print(f"File not found: {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    # Save results
    output_file = "training_piece_analysis.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        # Convert Counter to dict for JSON serialization
        json_results = {}
        for file_path, result in results.items():
            json_results[file_path] = {
                "total_entries": result["total_entries"],
                "piece_counts": result["piece_counts"],
                "trigger_counts": [(list(k), v) for k, v in result["trigger_counts"]],
                "action_counts": [(list(k), v) for k, v in result["action_counts"]],
                "piece_fields": result["piece_fields"],
            }
        json.dump(json_results, f, indent=2)
    
    print(f"\n✅ Analysis saved to: {output_file}")

if __name__ == "__main__":
    main()

