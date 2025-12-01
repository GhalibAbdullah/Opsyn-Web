-- Check project f owner
-- Run: sqlite3 dev/config/database.sqlite < scripts/check-project-f-owner.sql

SELECT 
    p.id,
    p.displayName,
    p.ownerId,
    ui.email as owner_email,
    ui.firstName || ' ' || ui.lastName as owner_name
FROM project p
JOIN user u ON p.ownerId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName = 'f';

