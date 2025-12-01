-- Check project owners for f and z_
-- Run: sqlite3 dev/config/database.sqlite < scripts/check-project-owners.sql

-- Check project f
SELECT 
    p.id,
    p.displayName,
    p.ownerId as project_owner_id,
    owner_ui.email as owner_email,
    owner_ui.firstName || ' ' || owner_ui.lastName as owner_name
FROM project p
LEFT JOIN user owner_u ON p.ownerId = owner_u.id
LEFT JOIN user_identity owner_ui ON owner_u.identityId = owner_ui.id
WHERE p.displayName = 'f';

-- Check project z_ (first one)
SELECT 
    p.id,
    p.displayName,
    p.ownerId as project_owner_id,
    owner_ui.email as owner_email,
    owner_ui.firstName || ' ' || owner_ui.lastName as owner_name
FROM project p
LEFT JOIN user owner_u ON p.ownerId = owner_u.id
LEFT JOIN user_identity owner_ui ON owner_u.identityId = owner_ui.id
WHERE p.displayName = 'z_'
ORDER BY p.id
LIMIT 1;

