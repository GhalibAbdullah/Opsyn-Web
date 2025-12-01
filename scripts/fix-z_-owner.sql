-- Fix project z_ owner to be Zohha instead of bsd
-- Run: sqlite3 dev/config/database.sqlite < scripts/fix-z_-owner.sql

-- Step 1: Get Zohha's user ID
SELECT u.id as zohha_user_id, ui.email
FROM user u
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- Step 2: Get the z_ project ID (use the first one or the one you want)
SELECT id, displayName, ownerId
FROM project
WHERE displayName = 'z_'
ORDER BY id
LIMIT 1;

-- Step 3: UPDATE project z_ owner to Zohha
-- Replace <ZOHHA_USER_ID> and <Z_PROJECT_ID> with actual IDs from steps 1 and 2
UPDATE project
SET ownerId = '<ZOHHA_USER_ID>'
WHERE id = '<Z_PROJECT_ID>' AND displayName = 'z_';

-- OR use a single query (safer):
UPDATE project
SET ownerId = (
    SELECT u.id
    FROM user u
    JOIN user_identity ui ON u.identityId = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
)
WHERE displayName = 'z_'
  AND id = (
    SELECT id FROM project 
    WHERE displayName = 'z_' 
    ORDER BY id 
    LIMIT 1
  );

-- Step 4: Verify the fix
SELECT 
    p.id,
    p.displayName,
    p.ownerId,
    ui.email as owner_email,
    ui.firstName || ' ' || ui.lastName as owner_name
FROM project p
JOIN user u ON p.ownerId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'z_'
ORDER BY p.id
LIMIT 1;

