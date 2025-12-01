-- Verify that Zohha was removed from project f
-- Run this in sqlite3: sqlite3 dev/config/database.sqlite < scripts/verify-deletion.sql

-- Check if Zohha still has any project_member records in project f
SELECT 
    pm.id,
    pm.projectId,
    pm.userId,
    pm.role,
    p.displayName as project_name,
    ui.email as user_email
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'f' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';
-- Should return 0 rows

-- Also check project z_ to make sure Zohha is still there
SELECT 
    pm.id,
    pm.projectId,
    pm.userId,
    pm.role,
    p.displayName as project_name,
    ui.email as user_email
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'z_' 
  AND LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';
-- Should return at least 1 row (if Zohha has an explicit member record)

