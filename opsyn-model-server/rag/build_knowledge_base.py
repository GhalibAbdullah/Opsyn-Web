#!/usr/bin/env python3
"""
Build Knowledge Base - One-command setup for RAG system.

This script:
1. Extracts all pieces from the Activepieces codebase
2. Generates embeddings for semantic search
3. Validates the output

Run this during build/deploy or whenever pieces change.

Usage:
    python -m rag.build_knowledge_base
    
Or:
    python rag/build_knowledge_base.py --pieces-path /path/to/packages/pieces
"""

import argparse
import sys
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Build RAG knowledge base")
    parser.add_argument(
        "--pieces-path",
        type=str,
        default=None,
        help="Path to packages/pieces directory"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for knowledge base files"
    )
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip embedding generation (faster, for testing)"
    )
    
    args = parser.parse_args()
    
    # Set paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent
    
    pieces_path = Path(args.pieces_path) if args.pieces_path else repo_root / "packages" / "pieces"
    output_dir = Path(args.output_dir) if args.output_dir else script_dir
    
    kb_path = output_dir / "pieces_knowledge_base.json"
    embeddings_path = output_dir / "pieces_embeddings.json"
    
    print("=" * 60)
    print("Building RAG Knowledge Base")
    print("=" * 60)
    print(f"Pieces path: {pieces_path}")
    print(f"Output dir: {output_dir}")
    print()
    
    # Check pieces path exists
    if not pieces_path.exists():
        print(f"ERROR: Pieces path not found: {pieces_path}")
        sys.exit(1)
    
    # Step 1: Extract pieces
    print("Step 1: Extracting pieces from codebase...")
    start_time = time.time()
    
    from .piece_extractor import PieceExtractor
    
    extractor = PieceExtractor(str(pieces_path))
    extractor.extract_all()
    extractor.save(str(kb_path))
    
    extract_time = time.time() - start_time
    print(f"  Extracted {len(extractor.pieces)} pieces in {extract_time:.2f}s")
    
    # Print summary
    total_actions = sum(len(p.actions) for p in extractor.pieces)
    total_triggers = sum(len(p.triggers) for p in extractor.pieces)
    print(f"  Total actions: {total_actions}")
    print(f"  Total triggers: {total_triggers}")
    print()
    
    # Step 2: Generate embeddings
    if not args.skip_embeddings:
        print("Step 2: Generating embeddings...")
        start_time = time.time()
        
        try:
            from .embedding_generator import EmbeddingGenerator
            
            generator = EmbeddingGenerator()
            generator.generate_from_knowledge_base(str(kb_path))
            generator.save_compact(str(embeddings_path))
            
            embed_time = time.time() - start_time
            print(f"  Generated {len(generator.embeddings)} embeddings in {embed_time:.2f}s")
        except ImportError as e:
            print(f"  WARNING: Could not generate embeddings: {e}")
            print("  Install sentence-transformers: pip install sentence-transformers")
    else:
        print("Step 2: Skipping embeddings (--skip-embeddings)")
    
    print()
    
    # Step 3: Validate
    print("Step 3: Validating output...")
    
    import json
    
    with open(kb_path, 'r') as f:
        kb = json.load(f)
    
    print(f"  Knowledge base: {kb['pieces_count']} pieces")
    
    if embeddings_path.exists():
        with open(embeddings_path, 'r') as f:
            emb = json.load(f)
        print(f"  Embeddings: {emb['count']} entries, dim={emb['dimension']}")
    
    print()
    print("=" * 60)
    print("Build complete!")
    print("=" * 60)
    print()
    print("Files created:")
    print(f"  - {kb_path}")
    if embeddings_path.exists():
        print(f"  - {embeddings_path}")
        vectors_path = str(embeddings_path).replace('.json', '_vectors.npy')
        if Path(vectors_path).exists():
            print(f"  - {vectors_path}")
    print()
    print("To test the RAG system:")
    print("  python -m rag.workflow_generator")


if __name__ == "__main__":
    main()

