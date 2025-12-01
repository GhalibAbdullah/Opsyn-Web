-- SQL queries to remove Zohha from project f
-- Run these queries directly in your database

-- ============================================================================
-- Step 1: Find project "f" ID
-- ============================================================================

-- PostgreSQL:
SELECT id, "displayName", "ownerId" 
FROM project 
WHERE "displayName" = 'f';

-- SQLite:
SELECT id, displayName, ownerId 
FROM project 
WHERE displayName = 'f';

-- ============================================================================
-- Step 2: Find Zohha's user ID
-- ============================================================================

-- PostgreSQL:
SELECT u.id as user_id, ui.email
FROM "user" u
JOIN user_identity ui ON u."identityId" = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- SQLite:
SELECT u.id as user_id, ui.email
FROM user u
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- ============================================================================
-- Step 3: Check if Zohha has a project_member record in project f
-- ============================================================================

-- PostgreSQL (replace <project_f_id> and <zohha_user_id> with actual IDs from steps 1 and 2):
SELECT pm.*, p."displayName" as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm."projectId" = p.id
JOIN "user" u ON pm."userId" = u.id
JOIN user_identity ui ON u."identityId" = ui.id
WHERE p."displayName" = 'f' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- SQLite:
SELECT pm.*, p.displayName as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'f' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- ============================================================================
-- Step 4: DELETE Zohha from project f
-- ============================================================================

-- PostgreSQL (replace <project_f_id> and <zohha_user_id> with actual IDs):
DELETE FROM project_member
WHERE "projectId" = '<project_f_id>' 
  AND "userId" = '<zohha_user_id>';

-- SQLite:
DELETE FROM project_member
WHERE projectId = '<project_f_id>' 
  AND userId = '<zohha_user_id>';

-- OR use the email-based delete (PostgreSQL):
DELETE FROM project_member
WHERE "projectId" IN (SELECT id FROM project WHERE "displayName" = 'f')
  AND "userId" IN (
    SELECT u.id 
    FROM "user" u
    JOIN user_identity ui ON u."identityId" = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
  );

-- OR use the email-based delete (SQLite):
DELETE FROM project_member
WHERE projectId IN (SELECT id FROM project WHERE displayName = 'f')
  AND userId IN (
    SELECT u.id 
    FROM user u
    JOIN user_identity ui ON u.identityId = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
  );

-- ============================================================================
-- Step 5: Verify deletion
-- ============================================================================

-- PostgreSQL:
SELECT pm.*, p."displayName" as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm."projectId" = p.id
JOIN "user" u ON pm."userId" = u.id
JOIN user_identity ui ON u."identityId" = ui.id
WHERE p."displayName" = 'f' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';
-- Should return 0 rows

-- SQLite:
SELECT pm.*, p.displayName as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'f' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';
-- Should return 0 rows

