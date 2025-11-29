# CE-Only Project Management Implementation

## Overview

This is a **100% open-source (MIT)** implementation of project management for Community Edition. It does NOT use any Enterprise code from `packages/ee/` or `packages/server/api/src/app/ee/`.

## What Was Created

### Backend (CE-Only)

1. **`project-management.controller.ts`** - New CE-only controller
   - `GET /v1/projects` - List all projects user has access to
   - `POST /v1/projects` - Create a new project
   - `PATCH /v1/projects/:id` - Update a project
   - `DELETE /v1/projects/:id` - Delete a project (soft delete)
   - **No Enterprise imports** - uses only CE code

2. **`project-service.ts`** - Added `delete()` method
   - Soft deletes projects
   - CE-only implementation

3. **`project-module.ts`** - Registered the new controller
   - Only registers in Community Edition

### Frontend

1. **Projects page** - Updated to default `manageProjectsEnabled` to `true` for CE
   - This allows the UI to work even if the flag isn't set

## Key Differences from Enterprise

| Feature | Enterprise | Our CE Implementation |
|---------|-----------|----------------------|
| **Code Location** | `packages/ee/` | `packages/server/api/src/app/project/` |
| **License** | Proprietary | MIT (Open Source) |
| **Project Limits** | Uses `projectLimitsService` (EE) | Simple project creation |
| **Project Plans** | Uses `ProjectPlan` entity (EE) | Direct project creation |
| **Dependencies** | Imports from `ee/` | No EE imports |

## How It Works

1. **Project Creation**: Uses `projectService.create()` (CE code)
2. **Project Listing**: Uses `projectService.getAllForUser()` (CE code)
3. **Project Updates**: Uses `projectService.update()` (CE code)
4. **Project Deletion**: Uses `projectService.delete()` (CE code - newly added)
5. **Permissions**: Uses our CE permission system (`assertCanManageTeam`)

## Open Source Compliance

✅ **All code is in CE packages**:
- `packages/server/api/src/app/project/` (CE)
- `packages/server/api/src/app/project-members/` (CE)
- `packages/server/api/src/app/authentication/` (CE)

✅ **No Enterprise imports**:
- No imports from `packages/ee/`
- No imports from `packages/server/api/src/app/ee/`

✅ **MIT License compatible**:
- All code follows Activepieces CE license
- Safe to rebrand and extend

## Usage

### Create a Project

```bash
POST /v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "My New Project"
}
```

### List Projects

```bash
GET /v1/projects
Authorization: Bearer <token>
```

### Update Project

```bash
PATCH /v1/projects/<project_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "Updated Name"
}
```

### Delete Project

```bash
DELETE /v1/projects/<project_id>
Authorization: Bearer <token>
```

## Frontend Integration

The frontend Projects page (`/platform/projects`) will work once:
1. The backend endpoints are available (✅ done)
2. The frontend API calls the correct endpoints (needs update)

**Note**: The frontend currently calls `/v1/projects` which should work, but it might be expecting Enterprise response format. You may need to update the frontend API client to match our CE response format.

## Next Steps

1. ✅ Backend endpoints created (CE-only)
2. ⏳ Update frontend API client if needed
3. ⏳ Test project creation/listing/update/delete
4. ⏳ Ensure UI works with CE response format

## Reverting Enterprise Flag Change

I previously modified `platform-plan.service.ts` to enable `manageProjectsEnabled` for new CE platforms. If you want to keep it completely separate, you can:

1. Revert that change
2. Always set `isEnabled = true` in the frontend for CE
3. Or manually enable it in the database for your platform

The controller itself doesn't check the flag - it only checks edition (must be CE).

