-- SQL queries to check database state for projects f and z_ and their members
-- Run these queries directly in your database

-- ============================================================================
-- 1. PROJECTS TABLE: Get projects f and z_
-- ============================================================================

-- PostgreSQL:
SELECT 
    id, 
    "displayName", 
    "ownerId", 
    "platformId", 
    created, 
    updated
FROM project
WHERE "displayName" IN ('f', 'z_')
ORDER BY "displayName";

-- SQLite:
SELECT 
    id, 
    displayName, 
    ownerId, 
    platformId, 
    created, 
    updated
FROM project
WHERE displayName IN ('f', 'z_')
ORDER BY displayName;

-- ============================================================================
-- 2. USER IDs: Get user IDs for bsd and Zohha
-- ============================================================================

-- PostgreSQL:
SELECT 
    u.id as user_id, 
    ui.email,
    ui."firstName" || ' ' || ui."lastName" as name
FROM "user" u
JOIN user_identity ui ON u."identityId" = ui.id
WHERE LOWER(TRIM(ui.email)) IN ('bsdsf22m042@pucit.edu.pk', 'zohhazhar13@gmail.com')
ORDER BY ui.email;

-- SQLite:
SELECT 
    u.id as user_id, 
    ui.email,
    ui.firstName || ' ' || ui.lastName as name
FROM user u
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) IN ('bsdsf22m042@pucit.edu.pk', 'zohhazhar13@gmail.com')
ORDER BY ui.email;

-- ============================================================================
-- 3. PROJECT_MEMBER TABLE: Get all members for projects f and z_
-- ============================================================================

-- PostgreSQL (replace <project_id_f> and <project_id_z_> with actual IDs from query 1):
SELECT 
    pm.id, 
    pm."projectId", 
    pm."userId", 
    pm.role, 
    pm."platformId", 
    pm.created, 
    pm.updated,
    p."displayName" as project_name,
    ui.email as user_email,
    ui."firstName" || ' ' || ui."lastName" as user_name
FROM project_member pm
JOIN project p ON pm."projectId" = p.id
JOIN "user" u ON pm."userId" = u.id
JOIN user_identity ui ON u."identityId" = ui.id
WHERE p."displayName" IN ('f', 'z_')
ORDER BY p."displayName", ui.email;

-- SQLite:
SELECT 
    pm.id, 
    pm.projectId, 
    pm.userId, 
    pm.role, 
    pm.platformId, 
    pm.created, 
    pm.updated,
    p.displayName as project_name,
    ui.email as user_email,
    ui.firstName || ' ' || ui.lastName as user_name
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE p.displayName IN ('f', 'z_')
ORDER BY p.displayName, ui.email;

-- ============================================================================
-- 4. COMPLETE VIEW: Projects with their owners and members in one query
-- ============================================================================

-- PostgreSQL:
SELECT 
    p.id as project_id,
    p."displayName" as project_name,
    p."ownerId" as project_owner_id,
    owner_ui.email as project_owner_email,
    owner_ui."firstName" || ' ' || owner_ui."lastName" as project_owner_name,
    pm.id as member_id,
    pm."userId" as member_user_id,
    pm.role as member_role,
    member_ui.email as member_email,
    member_ui."firstName" || ' ' || member_ui."lastName" as member_name,
    CASE 
        WHEN pm."userId" = p."ownerId" THEN 'OWNER (from project.ownerId)'
        WHEN pm.id IS NOT NULL THEN 'EXPLICIT MEMBER'
        ELSE 'NO MEMBER RECORD'
    END as member_type
FROM project p
LEFT JOIN "user" owner_u ON p."ownerId" = owner_u.id
LEFT JOIN user_identity owner_ui ON owner_u."identityId" = owner_ui.id
LEFT JOIN project_member pm ON pm."projectId" = p.id
LEFT JOIN "user" member_u ON pm."userId" = member_u.id
LEFT JOIN user_identity member_ui ON member_u."identityId" = member_ui.id
WHERE p."displayName" IN ('f', 'z_')
ORDER BY p."displayName", 
         CASE WHEN pm."userId" = p."ownerId" THEN 0 ELSE 1 END,
         member_ui.email;

-- SQLite:
SELECT 
    p.id as project_id,
    p.displayName as project_name,
    p.ownerId as project_owner_id,
    owner_ui.email as project_owner_email,
    owner_ui.firstName || ' ' || owner_ui.lastName as project_owner_name,
    pm.id as member_id,
    pm.userId as member_user_id,
    pm.role as member_role,
    member_ui.email as member_email,
    member_ui.firstName || ' ' || member_ui.lastName as member_name,
    CASE 
        WHEN pm.userId = p.ownerId THEN 'OWNER (from project.ownerId)'
        WHEN pm.id IS NOT NULL THEN 'EXPLICIT MEMBER'
        ELSE 'NO MEMBER RECORD'
    END as member_type
FROM project p
LEFT JOIN user owner_u ON p.ownerId = owner_u.id
LEFT JOIN user_identity owner_ui ON owner_u.identityId = owner_ui.id
LEFT JOIN project_member pm ON pm.projectId = p.id
LEFT JOIN user member_u ON pm.userId = member_u.id
LEFT JOIN user_identity member_ui ON member_u.identityId = member_ui.id
WHERE p.displayName IN ('f', 'z_')
ORDER BY p.displayName, 
         CASE WHEN pm.userId = p.ownerId THEN 0 ELSE 1 END,
         member_ui.email;

