# Invitation System Explanation

## Difference: "Dev's Project" vs "Entire Platform"

### **"Dev's Project (Current Project)"** - Project-Level Invitation
- **What it does**: Invites the user to **one specific project** only
- **Access granted**: User can only access the project you're currently in
- **Role options**: OWNER, EDITOR, or VIEWER (for that specific project)
- **Use case**: Day-to-day collaboration - invite team members to work on specific projects
- **Example**: Invite Alice as EDITOR to "Marketing Automation" project → Alice can only see/edit flows in that project

### **"Entire Platform"** - Platform-Level Invitation
- **What it does**: Invites the user to the **entire platform** (system-level access)
- **Access granted**: User gets a platform account but **NO automatic project access**
- **Role options**: ADMIN, MEMBER, or OPERATOR (platform-level roles)
- **Use case**: System administration - for Dev user to invite other admins
- **Example**: Invite Bob as ADMIN to platform → Bob has admin privileges but must be explicitly invited to each project

**Key Point**: In the new system, platform invites do NOT automatically add users to all projects. They must be explicitly invited to each project.

---

## Where to Create New Projects

### Option 1: Platform Settings → Projects (Recommended)
1. Click on your profile/avatar in the top right
2. Go to **Platform Settings** (or navigate to `/platform/projects`)
3. Click **"New Project"** button
4. Enter project name and create

**Note**: This might be locked behind a feature flag (`manageProjectsEnabled`). In Community Edition, this should be enabled by default.

### Option 2: Check if Feature is Enabled
If you don't see the Projects page:
- The feature might be disabled in your platform settings
- Check if `platform.plan.manageProjectsEnabled` is `true`
- In CE, this should be enabled by default

### Option 3: API/Direct Database
If the UI option isn't available, you can create projects via:
- API endpoint: `POST /v1/projects`
- Or directly in the database (for dev/testing)

---

## Current Issue: Role Selector Bug

I've fixed the bug where the role selector was showing project/platform options instead of roles (OWNER/EDITOR/VIEWER). The fix uses `form.watch('type')` to reactively show the correct selector.

**After the fix**, when you:
1. Select "Dev's Project (Current Project)" → You'll see a **role selector** with OWNER/EDITOR/VIEWER
2. Select "Entire Platform" → You'll see a **platform role selector** with ADMIN/MEMBER/OPERATOR

---

## Quick Test

1. **Refresh your browser** (hard refresh: Ctrl+Shift+R)
2. Click "Invite" button
3. You should see:
   - First dropdown: "Invite To" → "Dev's Project (Current Project)" (selected)
   - Second dropdown: "Select Project Role" → OWNER, EDITOR, VIEWER options

If it's still not working, check the browser console for errors.

