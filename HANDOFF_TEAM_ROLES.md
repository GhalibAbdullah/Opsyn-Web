# Handoff Document: Team Roles & Permissions Implementation

## Project Context

**Project:** ActivePieces Community Edition (open-source workflow automation platform)  
**Repository:** `/home/alien/dev/activepieces`  
**Current Branch:** `feature/team-roles-permissions` (based on `main`)  
**Database:** SQLite3 (via `.env` configuration), with plan to migrate to PostgreSQL later

## What's Been Implemented

### 1. Flow Activity Log
- **Location:** `packages/server/api/src/app/flows/flow-activity/`
- **Frontend:** `packages/react-ui/src/app/builder/flow-activity/`
- **Features:**
  - Logs workflow create, update, delete, publish operations
  - Displays activity with user info, timestamps, icons
  - Search and filter by action type
  - Integrated into builder sidebar
- **Database:** `flow_activity` table (SQLite + PostgreSQL migrations exist)

### 2. Workflow Comments
- **Location:** `packages/server/api/src/app/flows/flow-comment/`
- **Frontend:** `packages/react-ui/src/app/builder/flow-comments/`
- **Features:**
  - Workflow-level and step-specific comments
  - Nested replies (parentCommentId)
  - Real-time WebSocket notifications
  - Collapse/expand replies functionality
  - Integrated into builder sidebar
- **Database:** `flow_comment` table (SQLite + PostgreSQL migrations exist)
- **Note:** Files are currently **uncommitted** (untracked) on the branch

## Current Branch State

**Branch:** `feature/team-roles-permissions`  
**Status:** 
- Based on `main` branch
- Workflow comments implementation exists but is **uncommitted** (untracked files)
- Ready for Team Roles & Permissions implementation

**Untracked Files (Workflow Comments):**
- `packages/shared/src/lib/flows/flow-comment.ts`
- `packages/shared/src/lib/flows/flow-comment-requests.ts`
- `packages/server/api/src/app/flows/flow-comment/` (entire directory)
- `packages/server/api/src/app/database/migration/postgres/1764000000000-AddFlowCommentTable.ts`
- `packages/server/api/src/app/database/migration/sqlite/1764000000000-AddFlowCommentTableSqlite.ts`
- `packages/react-ui/src/app/builder/flow-comments/` (entire directory)
- `packages/react-ui/src/features/flows/lib/flow-comment-api.ts`
- `packages/react-ui/src/features/flows/lib/flow-comment-hooks.ts`

**Modified Files (not yet committed):**
- Various integration points (database-connection.ts, flow.module.ts, builder components, etc.)

## New User Story: Team Roles & Permissions

### Requirements

**Title:** Team Roles & Permissions  
**Priority:** Medium  
**User Story:** "As a team admin, I want to assign roles so that I can control who can edit or view workflows."

**Key Requirements:**
1. Invite collaborators via email (already exists via platform invites)
2. Assign/modify roles: **OWNER / EDITOR / VIEWER**
3. Permissions control:
   - **EDIT** workflows (OWNER, EDITOR)
   - **COMMENT** on workflows (OWNER, EDITOR)
   - **VIEW ONLY** (VIEWER - can see but not edit/comment)
4. Permissions should update immediately when roles change

### Current Behavior (to preserve)

**Community Edition:**
- All platform admins (`PlatformRole.ADMIN`) can edit flows and collaborate
- Real-time collaboration assumes "user is allowed to edit"
- Invitations via `userInvitationsService` exist but don't have project-level roles

**Key Code Location:** `packages/server/api/src/app/user/user-service.ts:172`
```typescript
async function getUsersForProject(platformId: PlatformId, projectId: string) {
    const platformAdmins = await userRepo().find({ where: { platformId, platformRole: PlatformRole.ADMIN } })
    const edition = system.getEdition()
    if (edition === ApEdition.COMMUNITY) {
        return platformAdmins  // <-- Currently returns all platform admins
    }
    // EE has ProjectMember logic here
}
```

## Implementation Strategy

### Approach: Lightweight ProjectMember for Community Edition

**Goal:** Add minimal role system without breaking existing functionality.

**Principles:**
1. **Current behavior = "Editor by default"** - treat existing users as EDITORs
2. **Only block VIEWER role** - all write operations check `role !== 'VIEWER'`
3. **Reuse EE patterns** - adapt `ProjectMember` entity but simplify for Community
4. **Database agnostic** - use TypeORM abstractions for SQLite + PostgreSQL

### Implementation Plan

#### Step 1: Create Community Edition ProjectMember Entity

**File:** `packages/server/api/src/app/project-members/project-member.entity.ts`

**Structure:**
```typescript
type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER'

// Entity should have:
// - id, projectId, userId, role
// - relations to Project and User
// - indexes on projectId, userId
// - cascade delete on project
```

**Key Patterns to Follow:**
- Look at EE version: `packages/ee/server/api/src/app/ee/project-members/project-member.entity.ts`
- Use database-agnostic types from `packages/server/api/src/app/database/database-common.ts`
- Register entity in `packages/server/api/src/app/database/database-connection.ts`

#### Step 2: Database Migrations

**Files Needed:**
- `packages/server/api/src/app/database/migration/sqlite/1765000000000-AddProjectMemberTableSqlite.ts`
- `packages/server/api/src/app/database/migration/postgres/1765000000000-AddProjectMemberTable.ts`

**Migration Strategy:**
- Create `project_member` table
- For existing users: create ProjectMember records with `role = 'EDITOR'` for all platform admins
- First project owner should get `role = 'OWNER'`

**Migration Pattern:**
- Look at existing migrations: `1764000000000-AddFlowCommentTable.ts` (same directory)
- Add to `packages/server/api/src/app/database/sqlite-connection.ts` and `postgres-connection.ts`

#### Step 3: ProjectMember Service

**File:** `packages/server/api/src/app/project-members/project-member.service.ts`

**Methods Needed:**
- `getByProjectId(projectId)` - get all members for a project
- `getByProjectIdAndUserId(projectId, userId)` - get user's role in project
- `create(params)` - add member to project
- `update(params)` - change member's role
- `delete(params)` - remove member from project
- `getDefaultRole(platformId, projectId, userId)` - determine default role (OWNER for first user, EDITOR for others)

**Key Logic:**
- Default role assignment:
  - If user is platform owner → OWNER
  - If user is first project member → OWNER
  - Otherwise → EDITOR (preserves current behavior)

#### Step 4: Permission Helper Functions

**File:** `packages/server/api/src/app/authentication/permission-helpers.ts` (or similar)

**Functions:**
```typescript
// Check if user can edit flows
async function assertCanEditFlow(
    projectId: ProjectId, 
    userId: UserId,
    edition: ApEdition
): Promise<void>

// Check if user can manage team (invite/remove/change roles)
async function assertCanManageTeam(
    projectId: ProjectId,
    userId: UserId,
    edition: ApEdition
): Promise<void>

// Get user's role in project
async function getUserProjectRole(
    projectId: ProjectId,
    userId: UserId,
    edition: ApEdition
): Promise<'OWNER' | 'EDITOR' | 'VIEWER'>
```

**Implementation Logic:**
- **Community Edition:**
  - Check `ProjectMember` table for user's role
  - If no record exists, default to 'EDITOR' (backward compatibility)
  - OWNER/EDITOR can edit, VIEWER cannot
- **Enterprise Edition:**
  - Delegate to existing EE RBAC system (don't break it)

#### Step 5: Integrate Permission Checks

**Files to Modify:**

1. **Flow Operations** (`packages/server/api/src/app/flows/flow/flow.controller.ts`):
   - `POST /` (create) - check `assertCanEditFlow`
   - `POST /:id` (update) - check `assertCanEditFlow`
   - `DELETE /:id` (delete) - check `assertCanEditFlow`

2. **Comment Operations** (`packages/server/api/src/app/flows/flow-comment/flow-comment.controller.ts`):
   - `POST /` (create) - check `assertCanEditFlow`
   - `PATCH /:commentId` (update) - check `assertCanEditFlow`
   - `DELETE /:commentId` (delete) - check `assertCanEditFlow`
   - `GET /` (list) - allow VIEWER (read-only)

3. **WebSocket Operations** (real-time collaboration):
   - Find WebSocket handler for flow operations
   - Check role before accepting write operations
   - VIEWER can receive updates but cannot send them

**Pattern:**
```typescript
// Before allowing operation:
await assertCanEditFlow(
    request.principal.projectId,
    request.principal.id,
    system.getEdition()
)
// If VIEWER, throws error. Otherwise continues.
```

#### Step 6: Update User Service

**File:** `packages/server/api/src/app/user/user-service.ts`

**Modify `getUsersForProject`:**
```typescript
async function getUsersForProject(platformId: PlatformId, projectId: string) {
    const edition = system.getEdition()
    if (edition === ApEdition.COMMUNITY) {
        // Get all platform admins (backward compatibility)
        const platformAdmins = await userRepo().find({ 
            where: { platformId, platformRole: PlatformRole.ADMIN } 
        })
        
        // Also get project members
        const projectMembers = await projectMemberService().getByProjectId(projectId)
        const memberUserIds = projectMembers.map(pm => pm.userId)
        
        // Combine and dedupe
        const allUserIds = [...new Set([
            ...platformAdmins.map(u => u.id),
            ...memberUserIds
        ])]
        
        return allUserIds
    }
    // EE logic unchanged
}
```

#### Step 7: Team Management API

**File:** `packages/server/api/src/app/project-members/project-member.controller.ts`

**Endpoints:**
- `GET /` - list all members for a project (with roles)
- `POST /` - add member to project (invite)
- `PATCH /:memberId` - update member's role
- `DELETE /:memberId` - remove member from project

**Permission Checks:**
- All endpoints require `assertCanManageTeam` (OWNER only)

**Integration:**
- Register in `packages/server/api/src/app/project/project.module.ts` or create new module

#### Step 8: Frontend Implementation

**New Files:**
- `packages/react-ui/src/features/project-members/` - API hooks and components
- `packages/react-ui/src/app/team-settings/` - Team management UI

**UI Components Needed:**
1. **Team Settings Page:**
   - List of project members with emails
   - Role dropdown (OWNER / EDITOR / VIEWER) per member
   - "Invite Member" button
   - Only visible to OWNER

2. **Builder UI Updates:**
   - Check user's role on mount
   - If VIEWER:
     - Disable drag/drop in canvas
     - Hide "Save" button
     - Disable comment input (show read-only)
     - Show "View Only" badge
   - Still show real-time updates and presence

3. **Permission Checks:**
   - Create hook: `useProjectRole()` to get current user's role
   - Use in components to conditionally render/disable features

**API Hooks Pattern:**
```typescript
// packages/react-ui/src/features/project-members/lib/project-member-hooks.ts
export const projectMemberHooks = {
    useProjectMembers: (projectId) => { ... },
    useProjectRole: (projectId) => { ... },
    useUpdateMemberRole: () => { ... },
    useInviteMember: () => { ... },
}
```

#### Step 9: Real-Time Role Updates

**WebSocket Events:**
- Add `PROJECT_MEMBER_ROLE_UPDATED` event
- When OWNER changes a role, emit event to project room
- Frontend invalidates role queries on event

**File:** `packages/shared/src/lib/websocket/index.ts` - add new event type

## Key Codebase Patterns

### Database Patterns
- **Entities:** Use TypeORM `EntitySchema` with `BaseColumnSchemaPart` from `database-common.ts`
- **Migrations:** Create separate SQLite and PostgreSQL versions in respective directories
- **Connection:** Register entities in `database-connection.ts`, migrations in `sqlite-connection.ts` / `postgres-connection.ts`

### API Patterns
- **Controllers:** Use `FastifyPluginAsyncTypebox` with TypeBox schemas
- **Services:** Factory pattern: `serviceName(request.log)`
- **Authorization:** Use `assertPrincipalHasPermissionToProject` or similar helpers

### Frontend Patterns
- **API Client:** `packages/react-ui/src/features/*/lib/*-api.ts`
- **React Query Hooks:** `packages/react-ui/src/features/*/lib/*-hooks.ts`
- **Components:** Follow existing component structure in `packages/react-ui/src/app/builder/`

### Shared Types
- **Location:** `packages/shared/src/lib/`
- **Export:** Add to `packages/shared/src/index.ts`
- **Use TypeBox:** For runtime validation and OpenAPI generation

## Important Files to Reference

### Existing Implementations
- Activity Log: `packages/server/api/src/app/flows/flow-activity/`
- Comments: `packages/server/api/src/app/flows/flow-comment/`
- EE ProjectMember: `packages/ee/server/api/src/app/ee/project-members/` (if exists)

### Key Services
- User Service: `packages/server/api/src/app/user/user-service.ts`
- Invitation Service: `packages/server/api/src/app/user-invitations/user-invitation.service.ts`
- Flow Service: `packages/server/api/src/app/flows/flow/flow.service.ts`

### Database
- Common types: `packages/server/api/src/app/database/database-common.ts`
- Connection: `packages/server/api/src/app/database/database-connection.ts`
- Migrations: `packages/server/api/src/app/database/migration/`

### Frontend
- Builder hooks: `packages/react-ui/src/app/builder/builder-hooks.ts`
- API client: `packages/react-ui/src/lib/api.ts`
- Socket provider: `packages/react-ui/src/components/socket-provider.tsx`

## Testing Considerations

1. **Backward Compatibility:**
   - Existing users should continue to work (treated as EDITORs)
   - Migration should create ProjectMember records for existing platform admins

2. **Permission Checks:**
   - VIEWER cannot create/update/delete flows
   - VIEWER cannot create/update/delete comments
   - VIEWER can view flows and comments
   - OWNER can manage team members
   - EDITOR can edit but not manage team

3. **Real-Time Collaboration:**
   - VIEWER can receive updates via WebSocket
   - VIEWER cannot send operations via WebSocket
   - OWNER/EDITOR behavior unchanged

## Git Workflow Notes

- **Current Branch:** `feature/team-roles-permissions`
- **Workflow Comments:** Files are uncommitted - you may want to commit them first or leave them for later
- **Commits:** Make atomic commits per logical unit (entity, migrations, service, controller, frontend)

## Questions to Answer During Implementation

1. Where exactly is the WebSocket handler for flow operations?
2. How does the invitation flow work - does it already create ProjectMember records?
3. Should OWNER role be automatically assigned to platform owner?
4. What happens when a user is removed from a project but has pending invitations?

## Success Criteria

✅ Users can be assigned OWNER, EDITOR, or VIEWER roles per project  
✅ OWNER can invite members and change roles  
✅ EDITOR can edit flows and comment (current behavior preserved)  
✅ VIEWER can view flows and comments but cannot edit  
✅ Real-time collaboration respects roles (VIEWER receives updates but cannot send)  
✅ Existing users continue to work (treated as EDITORs by default)  
✅ Permissions update immediately when roles change  

---

## Quick Start Commands

```bash
# Make sure you're on the right branch
git checkout feature/team-roles-permissions

# Check untracked files (workflow comments)
git status

# Start dev server (if needed)
npm run dev

# Check existing ProjectMember in EE (if you want to reference it)
find packages/ee -name "*project-member*" -type f
```

---

**Good luck with the implementation!** 🚀

