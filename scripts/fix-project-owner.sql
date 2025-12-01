-- SQL to check and fix project owner for project "f"
-- Run these queries to verify and fix the project owner

-- Step 1: Check current project owner
SELECT 
    p.id as project_id,
    p."displayName" as project_name,
    p."ownerId" as current_owner_id,
    u_owner.id as owner_user_id,
    ui_owner.email as owner_email,
    ui_owner."firstName" || ' ' || ui_owner."lastName" as owner_name
FROM project p
LEFT JOIN "user" u_owner ON p."ownerId" = u_owner.id
LEFT JOIN user_identity ui_owner ON u_owner."identityId" = ui_owner.id
WHERE p."displayName" = 'f' OR p.id = 'TVmzIolrHNfKYNs4QFpWS';

-- Step 2: Find bs d's user ID (should be the owner)
SELECT 
    u.id as user_id,
    ui.email,
    ui."firstName" || ' ' || ui."lastName" as name
FROM "user" u
JOIN user_identity ui ON u."identityId" = ui.id
WHERE LOWER(TRIM(ui.email)) = 'bsdsf22m042@pucit.edu.pk';

-- Step 3: Update project owner to bs d (if needed)
-- Replace <bs_d_user_id> with the actual user ID from step 2
-- UPDATE project 
-- SET "ownerId" = '<bs_d_user_id>'
-- WHERE "displayName" = 'f' OR id = 'TVmzIolrHNfKYNs4QFpWS';

-- Step 4: Verify the fix
SELECT 
    p.id as project_id,
    p."displayName" as project_name,
    p."ownerId" as owner_id,
    ui.email as owner_email,
    ui."firstName" || ' ' || ui."lastName" as owner_name
FROM project p
JOIN "user" u ON p."ownerId" = u.id
JOIN user_identity ui ON u."identityId" = ui.id
WHERE p."displayName" = 'f' OR p.id = 'TVmzIolrHNfKYNs4QFpWS';

