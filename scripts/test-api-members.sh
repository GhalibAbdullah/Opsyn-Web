#!/bin/bash

# Script to test the API endpoints for project members
# Usage: ./scripts/test-api-members.sh <project_f_id> <project_z_id> <auth_token>

PROJECT_F_ID=$1
PROJECT_Z_ID=$2
AUTH_TOKEN=$3
API_BASE_URL=${4:-"http://localhost:3000"}

if [ -z "$PROJECT_F_ID" ] || [ -z "$PROJECT_Z_ID" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: $0 <project_f_id> <project_z_id> <auth_token> [api_base_url]"
    echo "Example: $0 TVmzIolrHNfKYNs4QFpWS xHz6N3heKoXbeDb5AH9Fg 'Bearer token...'"
    exit 1
fi

echo "Testing Project Members API"
echo "============================"
echo ""

echo "📁 Project f members:"
echo "GET ${API_BASE_URL}/v1/project-members?projectId=${PROJECT_F_ID}"
curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_F_ID}" | jq '.'
echo ""
echo ""

echo "📁 Project z_ members:"
echo "GET ${API_BASE_URL}/v1/project-members?projectId=${PROJECT_Z_ID}"
curl -s -H "Authorization: ${AUTH_TOKEN}" \
     -H "Content-Type: application/json" \
     "${API_BASE_URL}/v1/project-members?projectId=${PROJECT_Z_ID}" | jq '.'
echo ""

