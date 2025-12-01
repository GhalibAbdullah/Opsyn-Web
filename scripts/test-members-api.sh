#!/bin/bash

# Script to test project members API
# Usage: ./scripts/test-members-api.sh <auth_token>

AUTH_TOKEN=$1
API_BASE_URL=${2:-"http://localhost:3000"}

PROJECT_F_ID="TVmzIolrHNfKYNs4QFpWS"
PROJECT_Z_ID="ozJl0UGkhmMVjGL1JI3N5"  # First z_ project

if [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: $0 <auth_token> [api_base_url]"
    echo ""
    echo "To get your auth token:"
    echo "1. Open your browser DevTools (F12)"
    echo "2. Go to Application/Storage tab → Local Storage"
    echo "3. Look for a key containing 'token' or 'auth'"
    echo "OR"
    echo "4. Go to Network tab, make any API request, and check the Authorization header"
    echo ""
    echo "Example:"
    echo "  $0 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
    exit 1
fi

echo "Testing Project Members API"
echo "============================"
echo ""

echo "📁 Project f members (ID: $PROJECT_F_ID):"
echo "GET ${API_BASE_URL}/v1/project-members?projectId=${PROJECT_F_ID}"
echo ""
curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_F_ID}" | jq '.' || curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_F_ID}"
echo ""
echo ""

echo "📁 Project z_ members (ID: $PROJECT_Z_ID):"
echo "GET ${API_BASE_URL}/v1/project-members?projectId=${PROJECT_Z_ID}"
echo ""
curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_Z_ID}" | jq '.' || curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_Z_ID}"
echo ""

