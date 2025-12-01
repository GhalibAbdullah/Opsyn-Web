# SQL Queries to Remove Zohha from Project "f"

Run these queries directly in your database to check and remove Zohha from project "f":

## For PostgreSQL:

```sql
-- Step 1: Find Zohha's user ID
SELECT u.id as user_id, ui.email, ui."firstName", ui."lastName"
FROM "user" u
JOIN user_identity ui ON u."identityId" = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- Step 2: Find project "f" 
SELECT id, "displayName", "ownerId", "platformId"
FROM project
WHERE "displayName" = 'f';

-- Step 3: Check if Zohha is a member of project "f"
SELECT pm.id, pm."projectId", pm."userId", pm.role, p."displayName" as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm."projectId" = p.id
JOIN "user" u ON pm."userId" = u.id
JOIN user_identity ui ON u."identityId" = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
  AND p."displayName" = 'f';

-- Step 4: Delete ProjectMember records (replace <member_id> with actual ID from step 3)
DELETE FROM project_member
WHERE id IN (
    SELECT pm.id
    FROM project_member pm
    JOIN project p ON pm."projectId" = p.id
    JOIN "user" u ON pm."userId" = u.id
    JOIN user_identity ui ON u."identityId" = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
      AND p."displayName" = 'f'
);
```

## For SQLite:

```sql
-- Step 1: Find Zohha's user ID
SELECT u.id as user_id, ui.email, ui.firstName, ui.lastName
FROM user u
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com';

-- Step 2: Find project "f"
SELECT id, displayName, ownerId, platformId
FROM project
WHERE displayName = 'f';

-- Step 3: Check if Zohha is a member of project "f"
SELECT pm.id, pm.projectId, pm.userId, pm.role, p.displayName as project_name, ui.email as user_email
FROM project_member pm
JOIN project p ON pm.projectId = p.id
JOIN user u ON pm.userId = u.id
JOIN user_identity ui ON u.identityId = ui.id
WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
  AND p.displayName = 'f';

-- Step 4: Delete ProjectMember records
DELETE FROM project_member
WHERE id IN (
    SELECT pm.id
    FROM project_member pm
    JOIN project p ON pm.projectId = p.id
    JOIN user u ON pm.userId = u.id
    JOIN user_identity ui ON u.identityId = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
      AND p.displayName = 'f'
);
```

## All-in-One Delete Query (PostgreSQL):

```sql
DELETE FROM project_member
WHERE id IN (
    SELECT pm.id
    FROM project_member pm
    JOIN project p ON pm."projectId" = p.id
    JOIN "user" u ON pm."userId" = u.id
    JOIN user_identity ui ON u."identityId" = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
      AND p."displayName" = 'f'
);
```

## All-in-One Delete Query (SQLite):

```sql
DELETE FROM project_member
WHERE id IN (
    SELECT pm.id
    FROM project_member pm
    JOIN project p ON pm.projectId = p.id
    JOIN user u ON pm.userId = u.id
    JOIN user_identity ui ON u.identityId = ui.id
    WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'
      AND p.displayName = 'f'
);
```

