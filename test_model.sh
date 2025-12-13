#!/bin/bash
# Test script for fine-tuned Qwen Coder 7B model
# Usage: ./test_model.sh <model_path_or_endpoint>

MODEL_PATH=${1:-"your_model_path_here"}
SYSTEM_PROMPT="You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY valid Activepieces flow JSON."

echo "=========================================="
echo "Testing Fine-tuned Qwen Coder 7B Model"
echo "=========================================="
echo ""

# Test Prompt 1: Simple Trigger-Action
echo "Test 1: Simple Trigger-Action"
echo "----------------------------------------"
PROMPT1="When a new row is added to Google Sheets 'Customer Orders', send a Slack message to #orders channel with the customer name and order total."
echo "Prompt: $PROMPT1"
echo ""
echo "User request: $PROMPT1"
echo ""
# Add your inference command here
# Example: python inference.py --model $MODEL_PATH --prompt "$PROMPT1" --system "$SYSTEM_PROMPT"
echo "Expected: Google Sheets trigger → Slack action with data access"
echo ""
echo "=========================================="
echo ""

# Test Prompt 2: Conditional Logic
echo "Test 2: Conditional Logic (ROUTER)"
echo "----------------------------------------"
PROMPT2="When a webhook is received, if the 'status' field equals 'urgent', send an email alert to support@company.com, otherwise add the payload to Google Sheets 'Webhook Logs'."
echo "Prompt: $PROMPT2"
echo ""
echo "User request: $PROMPT2"
echo ""
# Add your inference command here
echo "Expected: Webhook trigger → ROUTER → Email OR Sheets action"
echo ""
echo "=========================================="
echo ""

# Test Prompt 3: Schedule Multi-step
echo "Test 3: Schedule Multi-step"
echo "----------------------------------------"
PROMPT3="Every Monday at 9 AM, get all rows from Google Sheets 'Weekly Tasks', use AI to generate a summary, and post it to Slack #weekly-updates channel."
echo "Prompt: $PROMPT3"
echo ""
echo "User request: $PROMPT3"
echo ""
# Add your inference command here
echo "Expected: Schedule trigger → Sheets → AI → Slack"
echo ""
echo "=========================================="
echo ""

# Test Prompt 4: Form with Enrichment
echo "Test 4: Form Submission with Enrichment"
echo "----------------------------------------"
PROMPT4="When a new Google Form response is submitted, check if the email domain is a business email (not gmail.com or yahoo.com), and if it is, send a Slack message to #sales with the form data."
echo "Prompt: $PROMPT4"
echo ""
echo "User request: $PROMPT4"
echo ""
# Add your inference command here
echo "Expected: Forms trigger → CODE → ROUTER → Slack"
echo ""
echo "=========================================="
echo ""

# Test Prompt 5: Email Processing
echo "Test 5: Email Processing"
echo "----------------------------------------"
PROMPT5="When a new email arrives in Gmail with subject containing 'Invoice', extract the sender email and invoice amount, then create a row in Google Sheets 'Invoices' with the sender email, amount, and current date."
echo "Prompt: $PROMPT5"
echo ""
echo "User request: $PROMPT5"
echo ""
# Add your inference command here
echo "Expected: Gmail trigger → CODE → Sheets action"
echo ""
echo "=========================================="
echo ""

echo "Test prompts generated. Run inference with your model and evaluate outputs."

