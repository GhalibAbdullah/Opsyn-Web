-- Find all projects where bsd is the owner
-- Run: sqlite3 dev/config/database.sqlite < scripts/find-bsd-projects.sql

SELECT 
    p.id,
    p.displayName,
    p.ownerId,
    ui.email as owner_email
FROM project p
JOIN user u ON p.ownerId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) = 'bsdsf22m042@pucit.edu.pk'
ORDER BY p.displayName, p.id;

