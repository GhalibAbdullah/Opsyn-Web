# Testing Checklist for Platform Admin Navigation Fix

## Summary of Changes

We made several changes to fix the issue where exiting platform admin would navigate to the wrong project:

1. **Disabled `useCurrentProject()` on platform admin routes** - Prevents fetching wrong project data
2. **Updated exit handlers** - Both `PlatformSidebar` and `SidebarUser` now prioritize:
   - Current URL (if already on a project route)
   - SessionStorage (stored project ID)
   - Token (last resort)
3. **SessionStorage tracking** - Stores project ID when entering/selecting projects
4. **Fixed `ProjectsPage`** - Fetches current project directly using token's project ID

## Testing Checklist

### ✅ Core Functionality Tests

- [ ] **Normal Project Navigation**
  - [ ] Switch between projects using project switcher
  - [ ] Navigate directly to project routes via URL
  - [ ] Verify project badge updates correctly when switching projects
  - [ ] Verify URL changes immediately when clicking a project

- [ ] **Platform Admin Navigation**
  - [ ] Navigate to platform admin from project "A"
  - [ ] Select project "B" from platform admin projects list
  - [ ] Verify navigation to project "B" is instant (URL changes immediately)
  - [ ] Exit platform admin and verify you return to project "B" (not "A")
  - [ ] Repeat with different projects to ensure consistency

- [ ] **Project Badge Display**
  - [ ] Verify badge shows correct project name on project routes
  - [ ] Verify badge does NOT show on platform admin routes
  - [ ] Verify badge updates when switching projects

### ✅ Edge Cases

- [ ] **Browser Refresh**
  - [ ] Refresh page while on a project route - should stay on same project
  - [ ] Refresh page while in platform admin - should stay in platform admin
  - [ ] Refresh page after selecting a project but before navigation completes

- [ ] **Direct URL Navigation**
  - [ ] Navigate directly to `/projects/{projectId}/flows` - should work
  - [ ] Navigate directly to `/platform/projects` - should work
  - [ ] Navigate directly to `/platform` - should redirect correctly

- [ ] **Multiple Tabs**
  - [ ] Open platform admin in one tab
  - [ ] Switch projects in another tab
  - [ ] Verify both tabs work independently (sessionStorage is per-tab)

- [ ] **Session Storage Cleanup**
  - [ ] Verify sessionStorage is cleared after exiting platform admin
  - [ ] Verify sessionStorage persists correctly during navigation

### ✅ Platform Admin Pages

- [ ] **Projects Page (`/platform/projects`)**
  - [ ] Verify current project checkbox is disabled (cannot delete active project)
  - [ ] Verify you can select and delete other projects
  - [ ] Verify clicking a project navigates to it correctly
  - [ ] Verify project list displays correctly

- [ ] **Other Platform Admin Pages**
  - [ ] Navigate through all platform admin pages (analytics, users, setup, security, infrastructure)
  - [ ] Verify no project badge appears on any platform admin page
  - [ ] Verify "Exit platform admin" works from all pages

### ✅ Exit Platform Admin Tests

- [ ] **Exit from Platform Admin Routes**
  - [ ] Exit from `/platform/projects` - should return to correct project
  - [ ] Exit from `/platform/analytics` - should return to correct project
  - [ ] Exit from `/platform/users` - should return to correct project
  - [ ] Exit from any other platform admin route - should work correctly

- [ ] **Exit from Project Route (if sidebar still visible)**
  - [ ] If somehow on a project route with platform sidebar visible, exit should stay on that project

- [ ] **Exit via Different Methods**
  - [ ] Click "Exit platform admin" button in sidebar
  - [ ] Click "Exit Platform Admin Settings" in user dropdown menu
  - [ ] Verify both methods work consistently

### ✅ Component-Specific Tests

- [ ] **ProjectDashboardLayout**
  - [ ] Verify it only renders on project routes (not platform admin)
  - [ ] Verify it loads project data correctly
  - [ ] Verify loading screen shows while project loads

- [ ] **DashboardPageHeader**
  - [ ] Verify project badge shows on project routes
  - [ ] Verify project badge does NOT show on platform admin routes
  - [ ] Verify all header functionality works (invite, settings, etc.)

- [ ] **ProjectsPage**
  - [ ] Verify current project is fetched correctly (for delete prevention)
  - [ ] Verify you cannot delete the currently active project
  - [ ] Verify project selection and navigation works

### ✅ Regression Tests

- [ ] **Project Switching**
  - [ ] Verify project switcher still works correctly
  - [ ] Verify switching projects updates all relevant UI elements

- [ ] **Project Settings**
  - [ ] Verify project settings pages load correctly
  - [ ] Verify project settings can be edited

- [ ] **Flow Builder**
  - [ ] Verify flow builder works correctly
  - [ ] Verify flows are associated with correct project

- [ ] **User Permissions**
  - [ ] Verify project-based permissions still work
  - [ ] Verify platform admin permissions still work

### ✅ Error Cases

- [ ] **No Project in SessionStorage**
  - [ ] Clear sessionStorage manually
  - [ ] Exit platform admin - should fall back to token's project or default route

- [ ] **Invalid Project ID**
  - [ ] Manually set invalid project ID in sessionStorage
  - [ ] Exit platform admin - should handle gracefully

- [ ] **Network Errors**
  - [ ] Simulate network failure when fetching project
  - [ ] Verify error handling works correctly

## Files Modified

1. `packages/react-ui/src/hooks/project-hooks.ts`
   - Disabled `useCurrentProject()` query on platform admin routes
   - Returns `undefined` for project on platform admin routes

2. `packages/react-ui/src/app/components/sidebar/platform/index.tsx`
   - Updated exit handler to check current URL first
   - Prioritizes sessionStorage over token

3. `packages/react-ui/src/app/components/sidebar/sidebar-user.tsx`
   - Updated exit handler with same logic as PlatformSidebar
   - Stores project ID when navigating to platform admin

4. `packages/react-ui/src/app/components/platform-layout.tsx`
   - Stores project ID in sessionStorage when entering platform admin (if not already set)

5. `packages/react-ui/src/app/routes/platform/projects/index.tsx`
   - Fetches current project directly using token's project ID
   - Removed dependency on `useCurrentProject()` hook

6. `packages/react-ui/src/app/components/dashboard-page-header.tsx`
   - Already had platform admin route check - no changes needed

## Key Safety Checks

✅ All components use optional chaining (`project?.id`)  
✅ `ProjectDashboardLayout` only used on project routes (not platform admin)  
✅ `DashboardPageHeader` checks `isPlatformAdminRoute` before showing badge  
✅ `ProjectsPage` handles undefined `currentProject` gracefully  
✅ SessionStorage is cleared after use  
✅ No linter errors

## Expected Behavior

- When you're in project "A" and navigate to platform admin, then select project "B", and exit platform admin, you should return to project "B"
- Project badge should show correct project name on project routes
- Project badge should NOT show on platform admin routes
- Navigation should be instant (URL changes immediately)

