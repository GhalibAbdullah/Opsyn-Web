# Testing Project Members API

After removing Zohha from project f, test the API endpoints to verify the fix.

## Step 1: Get Project IDs

Run these SQL queries to get the project IDs:

```sql
-- PostgreSQL:
SELECT id, "displayName" FROM project WHERE "displayName" IN ('f', 'z_');

-- SQLite:
SELECT id, displayName FROM project WHERE displayName IN ('f', 'z_');
```

## Step 2: Get Auth Token

You'll need an authentication token. This is typically obtained by logging in through the frontend or API.

## Step 3: Test API Endpoints

### Using curl:

```bash
# Replace <PROJECT_F_ID> and <PROJECT_Z_ID> with actual IDs from Step 1
# Replace <AUTH_TOKEN> with your actual auth token

# Test project f
curl -H "Authorization: Bearer <AUTH_TOKEN>" \
     -H "Content-Type: application/json" \
     "http://localhost:3000/v1/project-members?projectId=<PROJECT_F_ID>"

# Test project z_
curl -H "Authorization: Bearer <AUTH_TOKEN>" \
     -H "Content-Type: application/json" \
     "http://localhost:3000/v1/project-members?projectId=<PROJECT_Z_ID>"
```

### Using the script:

```bash
chmod +x scripts/test-api-members.sh
./scripts/test-api-members.sh <PROJECT_F_ID> <PROJECT_Z_ID> "Bearer <AUTH_TOKEN>"
```

## Expected Results

### Project f response should:
- ✅ NOT contain any entry for Zohha (zohhazhar13@gmail.com)
- ✅ Contain bsd (bsdsf22m042@pucit.edu.pk) as owner

### Project z_ response should:
- ✅ Contain Zohha (zohhazhar13@gmail.com) as owner
- ✅ Contain bsd (bsdsf22m042@pucit.edu.pk) as editor

## Example Response Format

```json
{
  "data": [
    {
      "id": "virtual-...",
      "projectId": "...",
      "userId": "...",
      "role": "OWNER",
      "user": {
        "email": "...",
        "firstName": "...",
        "lastName": "..."
      }
    }
  ],
  "next": null,
  "previous": null
}
```

