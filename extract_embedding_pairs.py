#!/usr/bin/env python3
"""
Extract training pairs for embedding model from:
1. piece_registry.json (canonical names + display names)
2. Training data (workflow examples)
3. Common variations and typos
"""

import json
import re
from pathlib import Path
from typing import List, Tuple, Dict, Set
from collections import defaultdict

def load_piece_registry() -> Dict:
    """Load the piece registry."""
    with open('piece_registry.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def load_training_data() -> List[Dict]:
    """Load training data from multiple sources."""
    all_data = []
    
    # Main training file
    main_file = Path('/mnt/c/Users/comps/Downloads/opsyn_alpaca_merged_v5_system (1).json')
    if main_file.exists():
        with open(main_file, 'r', encoding='utf-8-sig') as f:
            all_data.extend(json.load(f))
    
    # Example flows
    example_file = Path('example_flows_training_entries.json')
    if example_file.exists():
        with open(example_file, 'r', encoding='utf-8') as f:
            all_data.extend(json.load(f))
    
    return all_data

def normalize_name(name: str) -> str:
    """Normalize a name for comparison."""
    return name.lower().replace('_', ' ').replace('-', ' ').replace('  ', ' ').strip()

def tokenize(name: str) -> List[str]:
    """Split name into tokens."""
    # Handle camelCase
    name = re.sub(r'([a-z])([A-Z])', r'\1_\2', name)
    # Split by separators
    tokens = re.split(r'[_\-\s]+', name.lower())
    return [t for t in tokens if t]

def generate_variations(name: str) -> List[str]:
    """Generate common variations of a name."""
    variations = [name]
    tokens = tokenize(name)
    
    # Different case formats
    variations.append('_'.join(tokens))  # snake_case
    variations.append('-'.join(tokens))  # kebab-case
    variations.append(''.join(t.capitalize() for t in tokens))  # PascalCase
    if tokens:
        variations.append(tokens[0] + ''.join(t.capitalize() for t in tokens[1:]))  # camelCase
    
    # Common prefixes to add/remove
    piece_prefixes = ['gmail_', 'slack_', 'googlesheets_', 'google_sheets_', 'github_', 
                      'webhook_', 'schedule_', 'hubspot_', 'notion_', 'drive_']
    
    for prefix in piece_prefixes:
        if name.startswith(prefix):
            variations.append(name[len(prefix):])  # Remove prefix
        # Don't add prefixes - that would create too many variations
    
    return list(set(variations))

def extract_pairs_from_registry(registry: Dict) -> List[Tuple[str, str, float]]:
    """
    Extract positive pairs from piece registry.
    Returns list of (text1, text2, similarity_score) tuples.
    """
    pairs = []
    
    for piece_name, piece_data in registry.items():
        short_piece = piece_name.split('/')[-1].replace('piece-', '')
        
        # Triggers
        for trigger in piece_data.get('triggers', []):
            canonical_name = trigger['name']
            display_name = trigger.get('displayName', '')
            
            # Positive pair: canonical name ↔ display name
            if display_name:
                pairs.append((canonical_name, normalize_name(display_name), 1.0))
            
            # Positive pairs: variations of canonical name
            for var in generate_variations(canonical_name):
                if var != canonical_name:
                    pairs.append((canonical_name, var, 0.95))
            
            # Positive pair: with piece context
            pairs.append((canonical_name, f"{short_piece} {normalize_name(display_name)}", 0.9))
        
        # Actions
        for action in piece_data.get('actions', []):
            canonical_name = action['name']
            display_name = action.get('displayName', '')
            
            # Positive pair: canonical name ↔ display name
            if display_name:
                pairs.append((canonical_name, normalize_name(display_name), 1.0))
            
            # Positive pairs: variations of canonical name
            for var in generate_variations(canonical_name):
                if var != canonical_name:
                    pairs.append((canonical_name, var, 0.95))
            
            # Positive pair: with piece context
            pairs.append((canonical_name, f"{short_piece} {normalize_name(display_name)}", 0.9))
    
    return pairs

def extract_pairs_from_training_data(training_data: List[Dict], registry: Dict) -> List[Tuple[str, str, float]]:
    """
    Extract pairs from training data showing which triggers/actions appear together.
    """
    pairs = []
    
    # Build a map of piece -> trigger/action usage
    piece_usage = defaultdict(lambda: {'triggers': set(), 'actions': set()})
    
    for entry in training_data:
        try:
            output = entry.get('output', '{}')
            if isinstance(output, str):
                flow = json.loads(output)
            else:
                flow = output
            
            # Extract trigger
            trigger = flow.get('trigger', {})
            settings = trigger.get('settings', {})
            piece_name = settings.get('pieceName', '')
            trigger_name = settings.get('triggerName', '')
            
            if piece_name and trigger_name:
                piece_usage[piece_name]['triggers'].add(trigger_name)
            
            # Extract actions recursively
            def extract_actions(action):
                if not action:
                    return
                settings = action.get('settings', {})
                piece_name = settings.get('pieceName', '')
                action_name = settings.get('actionName', '')
                
                if piece_name and action_name:
                    piece_usage[piece_name]['actions'].add(action_name)
                
                # Recurse
                if 'nextAction' in action:
                    extract_actions(action['nextAction'])
                for child in action.get('children', []):
                    extract_actions(child)
                if 'firstLoopAction' in action:
                    extract_actions(action['firstLoopAction'])
            
            extract_actions(trigger.get('nextAction'))
            
        except (json.JSONDecodeError, KeyError, TypeError):
            continue
    
    # For each piece, create pairs between the names used in training and canonical names
    for piece_name, usage in piece_usage.items():
        if piece_name not in registry:
            continue
        
        piece_data = registry[piece_name]
        canonical_triggers = {t['name'] for t in piece_data.get('triggers', [])}
        canonical_actions = {a['name'] for a in piece_data.get('actions', [])}
        
        # Training trigger names that don't match canonical
        for used_trigger in usage['triggers']:
            for canonical in canonical_triggers:
                # If they're similar but not exact, create a pair
                if used_trigger != canonical:
                    # Check if they might be related
                    used_tokens = set(tokenize(used_trigger))
                    canonical_tokens = set(tokenize(canonical))
                    overlap = len(used_tokens & canonical_tokens)
                    if overlap > 0:
                        similarity = overlap / max(len(used_tokens), len(canonical_tokens))
                        if similarity > 0.3:
                            pairs.append((canonical, used_trigger, similarity))
        
        # Training action names that don't match canonical
        for used_action in usage['actions']:
            for canonical in canonical_actions:
                if used_action != canonical:
                    used_tokens = set(tokenize(used_action))
                    canonical_tokens = set(tokenize(canonical))
                    overlap = len(used_tokens & canonical_tokens)
                    if overlap > 0:
                        similarity = overlap / max(len(used_tokens), len(canonical_tokens))
                        if similarity > 0.3:
                            pairs.append((canonical, used_action, similarity))
    
    return pairs

def generate_semantic_pairs() -> List[Tuple[str, str, float]]:
    """
    Generate pairs for semantic understanding.
    These teach the model that certain words mean similar things in this domain.
    """
    semantic_groups = [
        # Message/notification verbs
        ['send', 'post', 'notify', 'alert', 'dispatch', 'transmit', 'publish', 'broadcast'],
        # Create verbs
        ['add', 'insert', 'create', 'new', 'append', 'make', 'generate'],
        # Read verbs
        ['get', 'fetch', 'retrieve', 'read', 'find', 'lookup', 'search', 'query', 'list'],
        # Update verbs
        ['update', 'edit', 'modify', 'change', 'patch', 'alter'],
        # Delete verbs
        ['delete', 'remove', 'trash', 'destroy', 'clear'],
        # Receive verbs
        ['receive', 'catch', 'handle', 'incoming', 'accept', 'capture'],
        # Message nouns
        ['message', 'msg', 'notification', 'alert', 'text', 'content'],
        # Row/record nouns
        ['row', 'record', 'entry', 'line', 'item', 'data'],
        # Email nouns
        ['email', 'mail', 'message', 'correspondence'],
        # Channel nouns
        ['channel', 'room', 'chat', 'group', 'thread'],
    ]
    
    pairs = []
    for group in semantic_groups:
        for i, word1 in enumerate(group):
            for word2 in group[i+1:]:
                # Create pairs with high similarity
                pairs.append((word1, word2, 0.85))
                # Also create compound variations
                for suffix in ['_message', '_row', '_email', '_channel', '_event']:
                    pairs.append((word1 + suffix, word2 + suffix, 0.85))
    
    return pairs

def generate_negative_pairs(registry: Dict) -> List[Tuple[str, str, float]]:
    """
    Generate negative pairs (things that should NOT match).
    """
    pairs = []
    
    all_triggers = []
    all_actions = []
    
    for piece_name, piece_data in registry.items():
        for trigger in piece_data.get('triggers', []):
            all_triggers.append((piece_name, trigger['name']))
        for action in piece_data.get('actions', []):
            all_actions.append((piece_name, action['name']))
    
    # Negative pairs: triggers from different pieces that sound similar
    import random
    random.seed(42)
    
    for i, (piece1, trigger1) in enumerate(all_triggers[:50]):  # Limit to avoid explosion
        for piece2, trigger2 in random.sample(all_triggers, min(5, len(all_triggers))):
            if piece1 != piece2 and trigger1 != trigger2:
                # These are different triggers from different pieces - low similarity
                pairs.append((trigger1, trigger2, 0.1))
    
    for i, (piece1, action1) in enumerate(all_actions[:50]):
        for piece2, action2 in random.sample(all_actions, min(5, len(all_actions))):
            if piece1 != piece2 and action1 != action2:
                pairs.append((action1, action2, 0.1))
    
    return pairs

def main():
    print("Loading data...")
    registry = load_piece_registry()
    training_data = load_training_data()
    
    print(f"  Registry: {len(registry)} pieces")
    print(f"  Training data: {len(training_data)} examples")
    
    print("\nExtracting pairs...")
    
    # Extract positive pairs from registry
    registry_pairs = extract_pairs_from_registry(registry)
    print(f"  Registry pairs: {len(registry_pairs)}")
    
    # Extract pairs from training data
    training_pairs = extract_pairs_from_training_data(training_data, registry)
    print(f"  Training data pairs: {len(training_pairs)}")
    
    # Generate semantic pairs
    semantic_pairs = generate_semantic_pairs()
    print(f"  Semantic pairs: {len(semantic_pairs)}")
    
    # Generate negative pairs
    negative_pairs = generate_negative_pairs(registry)
    print(f"  Negative pairs: {len(negative_pairs)}")
    
    # Combine all pairs
    all_pairs = registry_pairs + training_pairs + semantic_pairs + negative_pairs
    
    # Deduplicate
    seen = set()
    unique_pairs = []
    for p in all_pairs:
        key = (p[0], p[1]) if p[0] < p[1] else (p[1], p[0])
        if key not in seen:
            seen.add(key)
            unique_pairs.append(p)
    
    print(f"\nTotal unique pairs: {len(unique_pairs)}")
    
    # Save pairs
    output = {
        'pairs': [{'text1': p[0], 'text2': p[1], 'score': p[2]} for p in unique_pairs],
        'stats': {
            'total_pairs': len(unique_pairs),
            'positive_pairs': len([p for p in unique_pairs if p[2] > 0.5]),
            'negative_pairs': len([p for p in unique_pairs if p[2] <= 0.5]),
        }
    }
    
    with open('embedding_training_pairs.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Saved to embedding_training_pairs.json")
    print(f"   Positive pairs: {output['stats']['positive_pairs']}")
    print(f"   Negative pairs: {output['stats']['negative_pairs']}")

if __name__ == '__main__':
    main()

