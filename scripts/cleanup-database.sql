-- Cleanup script: Delete all projects and project members
-- WARNING: This will delete ALL projects and project members!
-- Users will remain, but they'll have no projects
-- Run: sqlite3 dev/config/database.sqlite < scripts/cleanup-database.sql

-- Step 1: Delete all project_member records
DELETE FROM project_member;

-- Step 2: Delete all projects
DELETE FROM project;

-- Step 3: Verify cleanup
SELECT COUNT(*) as remaining_projects FROM project;
SELECT COUNT(*) as remaining_members FROM project_member;

-- Step 4: Show remaining users (they should still exist)
SELECT u.id, ui.email, ui.firstName || ' ' || ui.lastName as name
FROM user u
JOIN user_identity ui ON u.identityId = ui.id
ORDER BY ui.email;

