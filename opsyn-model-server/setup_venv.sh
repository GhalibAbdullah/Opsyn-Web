#!/bin/bash
# Setup script for RAG system virtual environment

cd "$(dirname "$0")"

echo "Setting up Python virtual environment..."

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r rag/requirements.txt

echo ""
echo "✅ Virtual environment setup complete!"
echo ""
echo "To activate in the future, run:"
echo "  source venv/bin/activate"
echo ""
echo "Then you can run:"
echo "  python -m rag.build_knowledge_base"
echo "  python -m rag.workflow_generator"
