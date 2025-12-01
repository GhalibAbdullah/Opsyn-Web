# Project-Scoped Architecture Implementation Plan

## Current State Analysis

✅ **Already Implemented:**
- Project entity exists with ownerId, platformId
- Flow entity already requires projectId (non-nullable)
- ProjectMember entity exists with OWNER/EDITOR/VIEWER roles
- ProjectMember service with CRUD operations
- Project permissions service (project-permissions.service.ts)
- Permission helpers (assertCanEditFlow, assertCanManageTeam)
- Flow comments backend (partially complete)
- Flow creation uses request.principal.projectId

❌ **Missing/Incomplete:**
- Flow authorization checks in all endpoints
- Default project creation on user signup
- Project management UI (list, create, delete, rename)
- Project member management UI (invite, roles, remove)
- Project switcher in main UI
- Project Settings UI (SMTP, AI keys) replacing platform admin
- Flow activity/history logging
- Flow comments frontend integration
- Navigation refactoring to be project-scoped
- Frontend flows view to be project-scoped

## Implementation Priority

### Phase 1: Core Backend (Critical)
1. ✅ Ensure all Flow endpoints check project permissions
2. ✅ Create default project on user signup
3. ✅ Add flow activity logging
4. ✅ Complete flow comments backend

### Phase 2: Project Management UI
5. ✅ Project list/create/delete/rename UI
6. ✅ Project member management UI
7. ✅ Project switcher component

### Phase 3: Settings & Features
8. ✅ Project Settings UI (SMTP, AI keys)
9. ✅ Flow comments frontend
10. ✅ Flow activity frontend

### Phase 4: Navigation & UX
11. ✅ Update navigation to be project-scoped
12. ✅ Update flows view to be project-scoped
13. ✅ Remove/refactor old platform admin UI

## Detailed Implementation Steps

### Step 1: Flow Authorization (Backend)
- [ ] Add permission checks to all flow endpoints
- [ ] Ensure VIEWER role cannot create/update/delete flows
- [ ] Ensure EDITOR/OWNER can edit flows
- [ ] Test authorization edge cases

### Step 2: Default Project Creation
- [ ] Hook into user signup flow
- [ ] Create default project for new users
- [ ] Add user as OWNER to their default project
- [ ] Migration for existing users (create default projects)

### Step 3: Flow Activity Logging
- [ ] Create FlowActivity entity
- [ ] Add activity logging to flow service methods
- [ ] Create activity list endpoint
- [ ] Add activity types: CREATED, UPDATED, DELETED, PUBLISHED, etc.

### Step 4: Project Management UI
- [ ] Projects list page
- [ ] Create project dialog
- [ ] Edit project dialog
- [ ] Delete project confirmation
- [ ] Project member management page

### Step 5: Project Settings
- [ ] Project settings page
- [ ] SMTP configuration form
- [ ] AI keys configuration form
- [ ] Save/update settings endpoints

### Step 6: Navigation Updates
- [ ] Add project switcher to header
- [ ] Update sidebar to show project context
- [ ] Update routes to be project-scoped
- [ ] Remove old platform admin routes

### Step 7: Flow Comments & Activity Frontend
- [ ] Comments panel in flow builder
- [ ] Activity timeline in flow builder
- [ ] Real-time updates via WebSocket

