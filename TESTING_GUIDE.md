# Testing Guide: Project-Level Collaboration Architecture

This guide walks you through testing the new project-level invitation and permission system.

## Prerequisites

1. **Clean Database** (recommended for first test):
   - Reset your database or use a fresh dev environment
   - This ensures no legacy data interferes with testing

2. **Multiple User Accounts**:
   - You'll need at least 2-3 email addresses to test invitations
   - Or use email aliases (e.g., `user+1@example.com`, `user+2@example.com`)

3. **Browser Setup**:
   - Use incognito/private windows or different browsers for different users
   - Or use browser profiles to simulate different users

## Test Scenarios

### Test 1: Permission Resolution (No Access)

**Goal**: Verify users without ProjectMember records cannot access projects.

**Steps**:
1. Log in as the Dev user (platform owner)
2. Create a new project (e.g., "Test Project A")
3. Note the project ID or name
4. Log out

5. Create a new user account (sign up with a different email)
6. Try to access the project:
   - Navigate to the project URL directly
   - Try to list flows in that project
   - Try to access the project via API

**Expected Result**:
- User should NOT see the project in their project list
- User should get a 403/404 error if trying to access directly
- User should NOT be able to list flows

**Verification**:
```bash
# Check database - user should have NO ProjectMember records
# Query: SELECT * FROM project_member WHERE userId = '<new_user_id>';
# Should return empty
```

---

### Test 2: Project-Level Invitation (Happy Path)

**Goal**: Verify project invitations work correctly in CE.

**Steps**:
1. Log in as Dev user
2. Create a project: "Test Project B"
3. Open the Invite User dialog (header button)
4. **Verify UI**:
   - Should default to "Invite To: [Project Name] (Current Project)"
   - Should show role selector with: OWNER, EDITOR, VIEWER
   - Platform invite option should only appear if you're platform owner
5. Invite a user:
   - Email: `testuser@example.com`
   - Type: PROJECT (should be default)
   - Role: EDITOR
   - Click "Invite"
6. Copy the invitation link (if shown) or check email

7. **Accept Invitation**:
   - Open invitation link in incognito window
   - Sign up/log in with the invited email
   - Accept the invitation

8. **Verify Access**:
   - User should see "Test Project B" in their project list
   - User should be able to access the project
   - User should be able to view and edit flows (EDITOR role)

**Verification**:
```bash
# Check database
SELECT * FROM project_member WHERE projectId = '<project_id>' AND userId = '<invited_user_id>';
# Should return one record with role = 'EDITOR'
```

---

### Test 3: Role-Based Permissions

**Goal**: Verify different roles have correct permissions.

#### Test 3a: VIEWER Role

**Steps**:
1. As project owner, invite a user with VIEWER role
2. Log in as the VIEWER user
3. Try to:
   - ✅ View flows (should work)
   - ✅ View flow runs (should work)
   - ❌ Edit/create flows (should fail)
   - ❌ Delete flows (should fail)
   - ❌ Add comments (should fail)
   - ❌ Manage project members (should fail)

**Expected**: VIEWER can view but not edit

#### Test 3b: EDITOR Role

**Steps**:
1. As project owner, invite a user with EDITOR role
2. Log in as the EDITOR user
3. Try to:
   - ✅ View flows
   - ✅ Create/edit/delete flows
   - ✅ Add/edit/delete comments
   - ✅ View runs
   - ❌ Manage project members (should fail)

**Expected**: EDITOR can edit but not manage members

#### Test 3c: OWNER Role

**Steps**:
1. As project owner, invite a user with OWNER role
2. Log in as the new OWNER user
3. Try to:
   - ✅ All EDITOR permissions
   - ✅ Invite users to project
   - ✅ Change member roles
   - ✅ Remove members

**Expected**: OWNER has full control

---

### Test 4: Platform Invites (No Auto-Add)

**Goal**: Verify platform invites don't auto-add users to all projects.

**Steps**:
1. Log in as Dev user (platform owner)
2. Create 2-3 projects: "Project X", "Project Y", "Project Z"
3. Open Invite User dialog
4. Select "Invite To: Entire Platform"
5. Invite a user with platform role: MEMBER
6. Accept invitation as the new user

**Expected Result**:
- User should be created with `platformRole: MEMBER`
- User should **NOT** see any projects in their list
- User should **NOT** have ProjectMember records for any projects

**Verification**:
```bash
# Check user
SELECT * FROM "user" WHERE email = '<invited_email>';
# platformRole should be 'MEMBER'

# Check project memberships
SELECT * FROM project_member WHERE userId = '<invited_user_id>';
# Should return empty (no auto-added memberships)
```

---

### Test 5: Remove Member (Access Revocation)

**Goal**: Verify removing a member actually revokes access.

**Steps**:
1. As project owner, invite a user as EDITOR
2. Log in as the EDITOR user
3. Verify they can access the project and edit flows
4. Log out

5. As project owner, remove the user from project members
6. Log in again as the removed user

**Expected Result**:
- User should NOT see the project in their list
- User should NOT be able to access the project
- User should get permission denied errors

**Verification**:
```bash
# Check database
SELECT * FROM project_member WHERE userId = '<removed_user_id>' AND projectId = '<project_id>';
# Should return empty (member was deleted)
```

---

### Test 6: Invite Existing User to New Project

**Goal**: Verify inviting an existing platform user to a project works.

**Steps**:
1. Create a user account (sign up)
2. Log in as Dev user
3. Create a new project: "Project New"
4. Invite the existing user to this project with EDITOR role
5. Log in as the existing user

**Expected Result**:
- User should see "Project New" in their project list
- User should have EDITOR access to this project
- User should NOT have access to other projects (unless explicitly invited)

---

### Test 7: Multiple Projects, Different Roles

**Goal**: Verify users can have different roles in different projects.

**Steps**:
1. As Dev user, create 3 projects: "Project A", "Project B", "Project C"
2. Invite the same user to all 3 projects with different roles:
   - Project A: OWNER
   - Project B: EDITOR
   - Project C: VIEWER
3. Log in as the invited user

**Expected Result**:
- User should see all 3 projects
- User should have OWNER permissions in Project A
- User should have EDITOR permissions in Project B
- User should have VIEWER permissions in Project C

---

### Test 8: Project Owner Always Has Access

**Goal**: Verify project owners always have OWNER role, even without explicit ProjectMember record.

**Steps**:
1. As Dev user, create a project
2. Check if you have a ProjectMember record (you might not)
3. Verify you can:
   - Access the project
   - Edit flows
   - Manage members
   - Invite users

**Expected**: Project owner should always have full access, even without explicit ProjectMember record.

---

## API Testing (Optional)

### Test Permission Endpoints

```bash
# Get current user's role in project
GET /v1/project-members/role
Headers: Authorization: Bearer <token>
# Should return: { "role": "OWNER" | "EDITOR" | "VIEWER" }

# List project members
GET /v1/project-members?projectId=<project_id>
Headers: Authorization: Bearer <token>
# Should return list of members with roles

# Create project member (invite)
POST /v1/project-members
Headers: Authorization: Bearer <token>
Body: {
  "userId": "<user_id>",
  "role": "EDITOR"
}
# Should create ProjectMember record

# Update member role
POST /v1/project-members/<member_id>
Headers: Authorization: Bearer <token>
Body: {
  "role": "VIEWER"
}
# Should update role

# Delete member
DELETE /v1/project-members/<member_id>
Headers: Authorization: Bearer <token>
# Should remove member
```

### Test Flow Permissions

```bash
# As VIEWER, try to create flow (should fail)
POST /v1/flows
Headers: Authorization: Bearer <viewer_token>
Body: { ... }
# Expected: 403 Permission Denied

# As EDITOR, try to create flow (should work)
POST /v1/flows
Headers: Authorization: Bearer <editor_token>
Body: { ... }
# Expected: 201 Created
```

---

## Database Verification Queries

### Check Project Members
```sql
SELECT 
    pm.id,
    pm."projectId",
    pm."userId",
    pm.role,
    u.email,
    p."displayName" as project_name
FROM project_member pm
JOIN "user" u ON pm."userId" = u.id
JOIN project p ON pm."projectId" = p.id
WHERE pm."platformId" = '<your_platform_id>'
ORDER BY p."displayName", pm.role;
```

### Check User Access
```sql
-- Projects a user can access (via ProjectMember or ownership)
SELECT DISTINCT p.id, p."displayName"
FROM project p
WHERE p."ownerId" = '<user_id>'
   OR p.id IN (
       SELECT "projectId" 
       FROM project_member 
       WHERE "userId" = '<user_id>'
   );
```

### Check Invitations
```sql
SELECT 
    id,
    email,
    type,
    status,
    "projectId",
    "projectRoleId",
    "platformRole"
FROM user_invitation
WHERE "platformId" = '<your_platform_id>'
ORDER BY created DESC;
```

---

## Common Issues & Troubleshooting

### Issue: User can still access project after being removed

**Check**:
1. Verify ProjectMember record was deleted:
   ```sql
   SELECT * FROM project_member WHERE "userId" = '<user_id>' AND "projectId" = '<project_id>';
   ```
2. Check if user is project owner:
   ```sql
   SELECT "ownerId" FROM project WHERE id = '<project_id>';
   ```
3. Clear browser cache / cookies
4. Verify permission service is being used (check logs)

### Issue: Invitation doesn't create ProjectMember

**Check**:
1. Verify invitation was accepted:
   ```sql
   SELECT status FROM user_invitation WHERE id = '<invitation_id>';
   ```
2. Check logs for errors during `provisionUserInvitation`
3. Verify `projectRoleId` contains valid role name (OWNER/EDITOR/VIEWER) for CE

### Issue: Default to EDITOR still happening

**Check**:
1. Verify you're using the new `project-permissions.service.ts`
2. Check that `getRole()` returns `null` for users without access
3. Verify `project-member.service.ts` uses the new permission service

---

## Success Criteria

✅ **All tests pass** if:
1. Users without ProjectMember records cannot access projects
2. Project invitations create ProjectMember records with correct roles
3. Platform invitations do NOT auto-add users to projects
4. Removing a member revokes their access
5. Different roles have correct permissions (VIEWER read-only, EDITOR can edit, OWNER can manage)
6. Project owners always have access (even without explicit ProjectMember)
7. Users can have different roles in different projects

---

## Next Steps After Testing

If all tests pass, proceed with:
- **Phase 3**: Real-time collaboration (WebSocket role checks)
- **Phase 4**: Project Settings UI (members management page)
- **Phase 5**: Migration & cleanup

If tests fail, check:
1. Database state (run verification queries)
2. Server logs for errors
3. Browser console for frontend errors
4. Permission service is being called correctly

