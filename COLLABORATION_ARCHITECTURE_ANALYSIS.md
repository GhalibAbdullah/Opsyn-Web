# Collaboration Architecture Analysis & Proposal

## Step 1: Current State Analysis (Community Edition)

### 1.1 Data Models

#### Project Entity
- **Location**: `packages/server/api/src/app/project/project-entity.ts`
- **Key Fields**:
  - `ownerId`: User who owns the project
  - `platformId`: Platform the project belongs to
  - `displayName`: Project name
- **Relations**: One-to-many with flows, folders, connections, etc.

#### User Entity
- **Location**: `packages/server/api/src/app/user/user-entity.ts`
- **Key Fields**:
  - `platformRole`: `ADMIN` | `MEMBER` | `OPERATOR` (platform-level role)
  - `platformId`: Platform the user belongs to
  - `identityId`: Links to UserIdentity (email, password, etc.)
- **Relations**: One-to-many with projects (as owner)

#### ProjectMember Entity (Community Edition)
- **Location**: `packages/server/api/src/app/project-members/project-member.entity.ts`
- **Key Fields**:
  - `projectId`: Project reference
  - `userId`: User reference
  - `platformId`: Platform reference
  - `role`: `'OWNER' | 'EDITOR' | 'VIEWER'` (project-level role)
- **Unique Constraint**: `(projectId, userId, platformId)`
- **Status**: Already exists in CE, but usage is inconsistent

### 1.2 Current Invitation Flow

#### Frontend Invite Dialog
- **Location**: `packages/react-ui/src/features/team/component/invite-user-dialog.tsx`
- **Current Behavior**:
  - Defaults to `InvitationType.PLATFORM` unless `platform.plan.projectRolesEnabled` is true
  - Platform invites require selecting a `platformRole` (ADMIN/MEMBER/OPERATOR)
  - Project invites are only available when `projectRolesEnabled` flag is true (Enterprise feature)
  - When project invites are enabled, it requires selecting a `projectRole` (from Enterprise project roles)

#### Backend Invitation Endpoint
- **Location**: `packages/server/api/src/app/user-invitations/user-invitation.module.ts`
- **Current Behavior**:
  - `POST /v1/user-invitations` accepts both PLATFORM and PROJECT invitation types
  - For PROJECT invites, it requires `platform.plan.projectRolesEnabled` to be true (line 154)
  - This effectively blocks project-level invites in Community Edition

#### Invitation Acceptance Flow
- **Location**: `packages/server/api/src/app/user-invitations/user-invitation.service.ts`
- **Current Behavior** (lines 66-140):
  - **PLATFORM invites** (Community Edition):
    - Sets user's `platformRole` (ADMIN/MEMBER/OPERATOR)
    - **Automatically adds user to ALL existing projects as EDITOR** (lines 95-110)
    - This is the problematic behavior - platform invites grant wide access
  - **PROJECT invites** (Enterprise only):
    - Requires `projectRolesEnabled` flag
    - Uses Enterprise `projectRoleId` system
    - Creates/updates `ProjectMember` record with Enterprise project role

### 1.3 Current Permission Enforcement

#### Permission Helpers
- **Location**: `packages/server/api/src/app/authentication/permission-helpers.ts`
- **Functions**:
  - `assertCanEditFlow()`: Checks if user is VIEWER (blocks), allows OWNER/EDITOR
  - `assertCanManageTeam()`: Checks if user is OWNER (blocks others)
  - `getUserProjectRole()`: Returns role, defaults to EDITOR for backward compatibility
  - `userHasProjectAccess()`: Checks if user has ProjectMember record or is owner

#### Project Member Service
- **Location**: `packages/server/api/src/app/project-members/project-member.service.ts`
- **Key Method**: `getRole()` (lines 185-238)
  - Returns `ProjectMemberRole | null`
  - **Logic**:
    1. If user is project owner → returns `'OWNER'`
    2. If user is platform admin → checks for explicit ProjectMember, otherwise defaults to `'EDITOR'`
    3. If user has ProjectMember record → returns that role
    4. **Otherwise defaults to `'EDITOR'`** (line 234) - this is problematic
  - **Issue**: Defaulting to EDITOR means users without explicit ProjectMember records still get edit access

#### Flow Controller
- **Location**: `packages/server/api/src/app/flows/flow/flow.controller.ts`
- **Permission Checks**:
  - `POST /v1/flows` (create): Calls `assertCanEditFlow()` (line 54)
  - `PATCH /v1/flows/:id` (update): Calls `assertCanEditFlow()` (line 136)
  - `DELETE /v1/flows/:id` (delete): Calls `assertCanEditFlow()` (line 257)
  - Also calls Enterprise `assertUserHasPermissionToFlow()` which is a no-op in CE

#### Flow Comment Controller
- **Location**: `packages/server/api/src/app/flows/flow-comment/flow-comment.controller.ts`
- **Permission Checks**:
  - All comment operations (create/update/delete) call `assertCanEditFlow()`
  - VIEWER role is blocked from commenting

#### Project Listing
- **Location**: `packages/server/api/src/app/project/project-service.ts` (lines 180-224)
- **Current Behavior**:
  - For CE: Uses `communityProjectMemberService.getIdsOfProjects()` to filter projects
  - Users can only see projects they own or have explicit ProjectMember records for
  - This is actually correct behavior

### 1.4 Real-Time Collaboration (WebSocket)

#### WebSocket Handlers
- **Location**: `packages/server/api/src/app/flows/flow/flow-websocket-handlers.ts`
- **Current Behavior**:
  - `handleEditorJoined()`: 
    - Checks `userHasProjectAccess()` before allowing join (line 88)
    - Joins user to flow-specific room: `flow:${flowId}`
    - Tracks active editors per flow
  - `broadcastFlowOperation()`:
    - **No role-based permission check** - broadcasts to all users in the room
    - Comment says "Permission checks are already done in the flow controller" (line 196)
    - **Issue**: If a VIEWER somehow joins the room, they can receive broadcasts but shouldn't be able to send operations

#### Flow Controller WebSocket Integration
- **Location**: `packages/server/api/src/app/flows/flow/flow.controller.ts`
- **Current Behavior**:
  - After flow operations, calls `broadcastFlowOperation()` to notify other editors
  - Permission check happens at REST level, but WebSocket operations aren't validated

### 1.5 Key Issues Identified

1. **Platform Invites Grant Wide Access**:
   - Accepting a platform invite automatically adds user to ALL projects as EDITOR
   - This defeats the purpose of project-level access control

2. **Project Invites Blocked in CE**:
   - Project-level invites require `projectRolesEnabled` flag (Enterprise feature)
   - Community Edition users can't invite to specific projects

3. **Inconsistent Permission Resolution**:
   - `getRole()` defaults to `'EDITOR'` when no ProjectMember record exists
   - This means removing a ProjectMember doesn't fully revoke access
   - Platform admins get EDITOR access even without explicit ProjectMember records

4. **WebSocket Operations Not Validated**:
   - Real-time collaboration doesn't check roles before broadcasting
   - VIEWER users could potentially send operations if they bypass REST checks

5. **Invite Dialog UX**:
   - Defaults to platform-level invites
   - Project-level option only appears when Enterprise feature is enabled

---

## Step 2: Proposed Clean Architecture

### 2.1 Data Model

#### Keep Existing ProjectMember Entity
- **No changes needed** - the CE `ProjectMember` entity is already well-designed
- Fields: `{ projectId, userId, platformId, role: 'OWNER' | 'EDITOR' | 'VIEWER' }`
- Unique constraint on `(projectId, userId, platformId)` prevents duplicates

#### Platform Role vs Project Role
- **Platform Role** (`platformRole`):
  - Purpose: System administration (Dev user, superuser)
  - Values: `ADMIN`, `MEMBER`, `OPERATOR`
  - Should NOT grant automatic project access in CE
  - Only the Dev user (initial platform owner) should have special privileges
  
- **Project Role** (`ProjectMember.role`):
  - Purpose: Day-to-day collaboration within projects
  - Values: `OWNER`, `EDITOR`, `VIEWER`
  - **This should be the primary access control mechanism**

#### Project Owner Handling
- Project `ownerId` should automatically grant `OWNER` role
- Project owners should always appear in ProjectMember list (can be virtual or explicit)
- When listing members, include owner even if no explicit ProjectMember record exists

### 2.2 Invitation Flow

#### Project-Level Invitations (Primary Path)
- **Remove dependency on `projectRolesEnabled` flag for CE**
- When inviting to a project:
  1. User selects project role: `OWNER`, `EDITOR`, or `VIEWER`
  2. Backend creates `UserInvitation` with:
     - `type: InvitationType.PROJECT`
     - `projectId: <current project>`
     - `projectRole: 'OWNER' | 'EDITOR' | 'VIEWER'` (stored as string, not projectRoleId)
  3. On acceptance:
     - Create/update user account with safe `platformRole: PlatformRole.MEMBER`
     - Create `ProjectMember` record with specified role
     - **Do NOT** add user to other projects

#### Platform-Level Invitations (Dev-Only)
- Keep as advanced feature for Dev user
- When inviting to platform:
  1. Only allowed if inviter is platform owner (Dev user)
  2. Sets `platformRole` (ADMIN/MEMBER/OPERATOR)
  3. **Do NOT** automatically add to projects
  4. User must be explicitly invited to projects

#### Invitation Acceptance Logic
```typescript
// Pseudo-code for provisionUserInvitation
switch (invitation.type) {
  case InvitationType.PROJECT:
    // Create user if needed (platformRole: MEMBER)
    const user = await getOrCreateUser(identity, platformId, { platformRole: PlatformRole.MEMBER })
    
    // Create ProjectMember with specified role
    await projectMemberService.create({
      userId: user.id,
      projectId: invitation.projectId,
      role: invitation.projectRole, // 'OWNER' | 'EDITOR' | 'VIEWER'
    })
    break
    
  case InvitationType.PLATFORM:
    // Only for Dev user
    const user = await getOrCreateUser(identity, platformId, { platformRole: invitation.platformRole })
    // Do NOT add to projects automatically
    break
}
```

### 2.3 Permission Resolution

#### Central Permission Service
Create a new service: `packages/server/api/src/app/authentication/project-permissions.service.ts`

```typescript
export const projectPermissionsService = (log: FastifyBaseLogger) => ({
  /**
   * Get user's effective role in project
   * Returns: 'OWNER' | 'EDITOR' | 'VIEWER' | null
   * null means no access
   */
  async getRole(projectId: ProjectId, userId: UserId): Promise<ProjectMemberRole | null> {
    const project = await projectService.getOneOrThrow(projectId)
    
    // 1. Project owner always has OWNER role
    if (project.ownerId === userId) {
      return 'OWNER'
    }
    
    // 2. Check explicit ProjectMember record
    const member = await projectMemberService(log).getByProjectIdAndUserId(projectId, userId)
    if (member) {
      return member.role
    }
    
    // 3. No access (return null, not default to EDITOR)
    return null
  },
  
  /**
   * Check if user can view flows in project
   */
  async canViewFlows(projectId: ProjectId, userId: UserId): Promise<boolean> {
    const role = await this.getRole(projectId, userId)
    return role !== null // Any role can view
  },
  
  /**
   * Check if user can edit flows in project
   */
  async canEditFlows(projectId: ProjectId, userId: UserId): Promise<boolean> {
    const role = await this.getRole(projectId, userId)
    return role === 'OWNER' || role === 'EDITOR'
  },
  
  /**
   * Check if user can manage project members
   */
  async canManageProjectMembers(projectId: ProjectId, userId: UserId): Promise<boolean> {
    const role = await this.getRole(projectId, userId)
    return role === 'OWNER'
  },
  
  /**
   * Check if user can participate in real-time collaboration (write operations)
   */
  async canParticipateInRealtimeCollab(projectId: ProjectId, userId: UserId): Promise<boolean> {
    const role = await this.getRole(projectId, userId)
    return role === 'OWNER' || role === 'EDITOR'
  },
})
```

#### Update Permission Helpers
- Replace `getUserProjectRole()` to use new service
- Update `assertCanEditFlow()` to use `canEditFlows()`
- Update `userHasProjectAccess()` to use `canViewFlows()`
- Remove default-to-EDITOR behavior

### 2.4 Real-Time Collaboration Alignment

#### WebSocket Permission Checks
- **On Join**: Already checks `userHasProjectAccess()` ✅
- **On Operation Broadcast**: Add role check before broadcasting
- **On Operation Receive**: Frontend should respect readonly mode for VIEWER

#### Flow WebSocket Handler Updates
```typescript
// In flow-websocket-handlers.ts
handleEditorJoined: (socket: Socket) => {
  return async (data: FlowEditorJoined, principal: UserPrincipal) => {
    // ... existing access check ...
    
    // Get user's role
    const role = await projectPermissionsService(log).getRole(flow.projectId, userId)
    
    // Emit role to client so frontend can set readonly mode
    socket.emit(WebsocketClientEvent.USER_PROJECT_ROLE, { role })
  }
}

// In flow controller, before broadcasting:
const canEdit = await projectPermissionsService(log).canParticipateInRealtimeCollab(
  projectId,
  userId
)
if (!canEdit) {
  throw new ActivepiecesError({ code: ErrorCode.PERMISSION_DENIED })
}
// Then broadcast...
```

#### Frontend Builder Updates
- When role is VIEWER, set `readonly: true` in builder store
- Disable operation buttons for VIEWER
- Allow VIEWER to receive broadcasts but not send operations

### 2.5 UX Improvements

#### Invite Dialog
- **Default to PROJECT invite** (not platform)
- Show project name: "Invite to: [Project Name]"
- Role selector: OWNER / EDITOR / VIEWER
- Platform invite only shown if user is platform owner (Dev user)

#### Project Settings → Members
- **Location**: New page or section in project settings
- Shows all members with their roles
- Allows OWNER to:
  - Invite new members (opens invite dialog)
  - Change member roles
  - Remove members
- Shows project owner prominently (even if no explicit ProjectMember record)

---

## Step 3: Implementation Plan

### Phase 1: Foundation (Permission Resolution)

**Goal**: Create consistent permission resolution that doesn't default to EDITOR

1. **Create `project-permissions.service.ts`**
   - Implement `getRole()`, `canViewFlows()`, `canEditFlows()`, etc.
   - Returns `null` for no access (no defaults)

2. **Update `project-member.service.ts`**
   - Modify `getRole()` to use new permission service
   - Remove default-to-EDITOR logic
   - Keep backward compatibility by checking if user is owner first

3. **Update `permission-helpers.ts`**
   - Replace implementations to use new permission service
   - Update `assertCanEditFlow()` to throw if role is null or VIEWER
   - Update `userHasProjectAccess()` to return false if role is null

4. **Test**: Verify that users without ProjectMember records can't access projects

### Phase 2: Invitation System

**Goal**: Enable project-level invitations in CE without Enterprise features

1. **Update `user-invitation.service.ts`**
   - Modify `provisionUserInvitation()`:
     - Remove automatic project addition for platform invites in CE
     - Add support for PROJECT invites with string role (not projectRoleId)
   - For PROJECT invites: create ProjectMember with specified role

2. **Update `user-invitation.module.ts`**
   - Remove `projectRolesEnabled` check for PROJECT invites in CE
   - Allow PROJECT invites when edition is COMMUNITY
   - Keep Enterprise checks for Enterprise edition

3. **Update Invite Dialog Frontend**
   - Default to PROJECT invite type
   - Show project role selector (OWNER/EDITOR/VIEWER) for CE
   - Only show platform invite if user is platform owner

4. **Test**: 
   - Invite user to project → verify ProjectMember created
   - Accept invitation → verify user can only access that project
   - Platform invite → verify user NOT added to all projects

### Phase 3: Real-Time Collaboration

**Goal**: Enforce roles in WebSocket operations

1. **Update `flow-websocket-handlers.ts`**
   - On `handleEditorJoined`: emit user's role to client
   - Add role check before allowing operation broadcasts
   - Block VIEWER from sending operations

2. **Update `flow.controller.ts`**
   - Before broadcasting operations, check `canParticipateInRealtimeCollab()`
   - Throw error if user is VIEWER

3. **Update Frontend Builder**
   - Listen for `USER_PROJECT_ROLE` WebSocket event
   - Set `readonly: true` when role is VIEWER
   - Disable operation buttons for VIEWER
   - Show visual indicator (badge) for VIEWER mode

4. **Test**:
   - VIEWER joins builder → readonly mode enabled
   - VIEWER tries to send operation → blocked
   - EDITOR/OWNER can send operations → works

### Phase 4: Project Settings UI

**Goal**: Add Project Settings → Members management UI

1. **Create Project Members Page**
   - List all members with roles
   - Show project owner prominently
   - Allow OWNER to invite, change roles, remove members

2. **Update Navigation**
   - Add "Members" or "Team" link in project settings
   - Show member count badge

3. **Test**: Full CRUD operations on project members

### Phase 5: Migration & Cleanup

**Goal**: Handle existing data and remove backward compatibility hacks

1. **Data Migration**
   - For existing platform-invited users in CE:
     - Option A: Remove their ProjectMember records from all projects (clean slate)
     - Option B: Keep existing ProjectMember records, but stop auto-adding to new projects
   - Recommendation: Option A for dev environment, document for production

2. **Remove Backward Compatibility**
   - Remove default-to-EDITOR logic
   - Remove automatic project addition for platform invites
   - Clean up virtual member logic (keep only for project owner display)

3. **Documentation**
   - Update API docs
   - Add migration guide for existing installations

### Implementation Order (Safe Steps)

1. ✅ **Step 1**: Create permission service (read-only, no behavior change)
2. ✅ **Step 2**: Update permission helpers to use new service (test thoroughly)
3. ✅ **Step 3**: Update invitation acceptance to NOT auto-add to projects (breaking change, but safe if tested)
4. ✅ **Step 4**: Enable project invites in CE (adds functionality)
5. ✅ **Step 5**: Update invite dialog UI (UX improvement)
6. ✅ **Step 6**: Add WebSocket role checks (security improvement)
7. ✅ **Step 7**: Add Project Settings UI (UX improvement)
8. ✅ **Step 8**: Cleanup and migration (polish)

### Testing Strategy

After each phase:
1. **Unit Tests**: Test permission resolution logic
2. **Integration Tests**: Test invitation flow end-to-end
3. **Manual Testing**:
   - Create project → invite user → verify access
   - Remove user → verify access revoked
   - Test VIEWER role → verify readonly behavior
   - Test real-time collaboration with different roles

### Rollback Plan

- Each phase should be independently deployable
- Keep old code paths behind feature flags if needed
- Database changes are additive (no destructive migrations)

---

## Trade-offs & Assumptions

### Assumptions
1. **Dev User**: There's one platform owner (Dev user) who needs platform-level access
2. **Existing Users**: It's acceptable to reset project memberships in dev environment
3. **Enterprise Compatibility**: Changes don't break Enterprise edition (guarded by edition checks)

### Trade-offs
1. **Breaking Change**: Platform invites no longer auto-add to projects
   - **Mitigation**: Document clearly, provide migration script
   
2. **Permission Resolution**: Returning `null` instead of defaulting to EDITOR
   - **Benefit**: Clear access control
   - **Risk**: Existing users might lose access
   - **Mitigation**: Migration script to create ProjectMember records for existing users

3. **Complexity**: Two invitation types (PLATFORM vs PROJECT)
   - **Benefit**: Flexible, supports both use cases
   - **Mitigation**: Clear UI that guides users to project invites

### Open Questions
1. **Project Owner**: Should project owner always have an explicit ProjectMember record, or can it be virtual?
   - **Recommendation**: Virtual is fine, but include in member list for visibility
   
2. **Platform Admins**: Should platform admins (besides Dev user) have any special privileges?
   - **Recommendation**: No, they should be invited to projects like everyone else

3. **Migration**: How to handle existing platform-invited users?
   - **Recommendation**: Provide script to audit and optionally create ProjectMember records

---

## Next Steps

1. **Review this proposal** - Confirm architecture aligns with goals
2. **Clarify open questions** - Decide on trade-offs
3. **Start Phase 1** - Implement permission service (safest first step)
4. **Iterate** - Test each phase before moving to next

