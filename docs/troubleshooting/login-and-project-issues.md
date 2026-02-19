# Login and Project Visibility Issues - Root Cause Analysis

## Issues Reported

1. **Users cannot sign in even with correct password**
2. **Projects disappear after sign-in**

## Root Cause Analysis

### Issue 1: Cannot Sign In

The login flow fails at the platform selection step. Here's the flow:

1. User enters email/password → `signInWithPassword()`
2. Password verified → `verifyIdentityPassword()` ✅
3. Platform selection → `getPersonalPlatformIdForIdentity()` ❌ **FAILS HERE**
4. If platform is null → throws "No platform found for identity"

**The Bug**: `getPersonalPlatformIdForIdentity()` calls `listPlatformsForIdentityWithAtleastProject()` which:
- Gets all users for the identity
- Filters out inactive users or users without platformId
- **Filters out platforms where user has NO projects** ← This is the problem
- Returns empty array if no platforms have projects
- `getPersonalPlatformIdForIdentity()` returns `null`
- Login fails with "No platform found for identity"

**Why this happens:**
- User's projects were deleted
- User was moved to a new platform without projects
- User never had projects created
- Project member records are missing

### Issue 2: Projects Disappear

Projects become invisible due to:

1. **Platform Mismatch**: User's `platformId` changed, but projects are in old platform
2. **Role Change**: User's `platformRole` changed from ADMIN to MEMBER, losing access to all projects
3. **Missing Project Memberships**: User is not owner and project_member records are missing
4. **Wrong Platform Selected**: Login selects a different platform than where projects exist

**The Logic**:
- `getAllForUser()` uses `getUsersFilters()` which:
  - If ADMIN/OPERATOR: Shows ALL projects in platform ✅
  - If MEMBER: Shows only projects where:
    - User is owner (`ownerId = userId`) OR
    - User is member (exists in `project_member` table)
  - If user is MEMBER but not owner and no project_member records → sees 0 projects ❌

## Diagnosis

Run the diagnostic script to identify the specific issue:

```bash
node scripts/diagnose-login-issues.js <email>
```

This will check:
- ✅ Email verification status
- ✅ User records and platform associations
- ✅ Platform selection logic
- ✅ Project visibility issues

## Solutions

### Quick Fix Script

Run the automated fix script:

```bash
node scripts/fix-user-login.js <email>
```

This script will:
1. Verify email if not verified
2. Create user record if missing
3. Create platform if user has no platform
4. Create default project if user has no projects
5. Fix user status if inactive

### Manual Fixes

#### Fix 1: Verify Email

```sql
-- PostgreSQL
UPDATE user_identity SET verified = true WHERE email = 'user@example.com';

-- SQLite
UPDATE user_identity SET verified = 1 WHERE email = 'user@example.com';
```

#### Fix 2: Create User Record (if missing)

```sql
-- First, get the identity ID
SELECT id FROM user_identity WHERE email = 'user@example.com';

-- Then create user record (replace IDENTITY_ID and PLATFORM_ID)
INSERT INTO "user" (id, created, updated, status, "platformRole", "identityId", "platformId")
VALUES ('USER_ID', NOW(), NOW(), 'ACTIVE', 'ADMIN', 'IDENTITY_ID', 'PLATFORM_ID');
```

#### Fix 3: Ensure User Has Projects

```sql
-- Check if user has projects
SELECT COUNT(*) FROM project 
WHERE "ownerId" = 'USER_ID' AND "platformId" = 'PLATFORM_ID' AND deleted IS NULL;

-- If 0, create a default project
INSERT INTO project (id, created, updated, "displayName", "ownerId", "platformId", "notifyStatus")
VALUES ('PROJECT_ID', NOW(), NOW(), 'Default Project', 'USER_ID', 'PLATFORM_ID', 'ALWAYS');
```

#### Fix 4: Fix Project Visibility

**Option A: Make user ADMIN** (sees all projects)
```sql
UPDATE "user" SET "platformRole" = 'ADMIN' WHERE id = 'USER_ID';
```

**Option B: Add project memberships** (for specific projects)
```sql
INSERT INTO project_member (id, created, updated, "userId", "projectId", "platformId", role)
VALUES ('MEMBER_ID', NOW(), NOW(), 'USER_ID', 'PROJECT_ID', 'PLATFORM_ID', 'EDITOR');
```

#### Fix 5: Fix Platform Selection

If user has multiple platforms but login selects wrong one:

1. Check which platform has the projects:
```sql
SELECT p.id, p.name, COUNT(pr.id) as project_count
FROM platform p
LEFT JOIN project pr ON pr."platformId" = p.id AND pr.deleted IS NULL
WHERE p.id IN (
    SELECT "platformId" FROM "user" WHERE "identityId" = 'IDENTITY_ID'
)
GROUP BY p.id, p.name;
```

2. Ensure that platform has at least one project (see Fix 3)

## Code-Level Fix (Recommended)

The proper fix is to modify `listPlatformsForIdentityWithAtleastProject` to not filter out platforms without projects, OR modify `getPersonalPlatformIdForIdentity` to fallback to platforms without projects.

**File**: `packages/server/api/src/app/platform/platform.service.ts`

**Current code** (line 31-46):
```typescript
async listPlatformsForIdentityWithAtleastProject(params: ListPlatformsForIdentityParams): Promise<PlatformWithoutSensitiveData[]> {
    const users = await userService.getByIdentityId({ identityId: params.identityId })
    
    const platformsWithProjects = await Promise.all(users.map(async (user) => {
        if (isNil(user.platformId) || user.status === UserStatus.INACTIVE) {
            return null
        }
        const hasProjects = await projectService.userHasProjects({
            platformId: user.platformId,
            userId: user.id,
        })
        return hasProjects ? user.platformId : null  // ← Filters out platforms without projects
    }))
    
    const platforms = await Promise.all(platformsWithProjects.filter((platformId) => !isNil(platformId)).map((platformId) => platformService.getOneWithPlanOrThrow(platformId)))
    return platforms
}
```

**Suggested fix**: Allow platforms without projects, or create a default project during login if none exists.

## Prevention

1. **Always create a default project** when creating a user/platform
2. **Never delete all projects** for a user (keep at least one)
3. **Maintain project_member records** when users are added to projects
4. **Don't change platformRole** from ADMIN to MEMBER without ensuring project access

## Related Files

- `packages/server/api/src/app/authentication/authentication.service.ts` - Login flow
- `packages/server/api/src/app/platform/platform.service.ts` - Platform selection
- `packages/server/api/src/app/project/project-service.ts` - Project visibility logic
- `packages/server/api/src/app/authentication/authentication-utils.ts` - Token generation
