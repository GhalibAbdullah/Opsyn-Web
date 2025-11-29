# Enabling Project Management in Community Edition

I've enabled `manageProjectsEnabled` for **new platforms** in CE. However, if you have an **existing platform**, you'll need to update it manually.

## For New Platforms

✅ **Already done!** New platforms created in CE will automatically have `manageProjectsEnabled: true`.

## For Existing Platforms

You need to update your existing platform's plan. You have two options:

### Option 1: Update via Database (Quick)

```sql
-- Update your platform plan to enable project management
UPDATE platform_plan 
SET "manageProjectsEnabled" = true 
WHERE "platformId" = '<your_platform_id>';
```

### Option 2: Update via API

```bash
# Get your platform ID first
# Then update the platform plan
curl -X PATCH http://localhost:4200/api/v1/platform \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "manageProjectsEnabled": true
    }
  }'
```

### Option 3: Create a Migration Script

Create a migration file to enable it for all CE platforms:

```typescript
// packages/server/api/src/app/database/migration/postgres/XXXXX-EnableProjectsForCE.ts
import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../helper/system/system'

export class EnableProjectsForCE implements MigrationInterface {
    name = 'EnableProjectsForCE'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        if (edition === ApEdition.COMMUNITY) {
            // Enable project management for all existing CE platforms
            await queryRunner.query(`
                UPDATE platform_plan 
                SET "manageProjectsEnabled" = true 
                WHERE "manageProjectsEnabled" = false
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert if needed
        await queryRunner.query(`
            UPDATE platform_plan 
            SET "manageProjectsEnabled" = false 
            WHERE "manageProjectsEnabled" = true
        `)
    }
}
```

## Verify It's Enabled

After updating, check:

1. **In the UI**: Go to Platform Settings → Projects
   - You should see the "New Project" button (no "Contact Sales" message)

2. **In the database**:
   ```sql
   SELECT "manageProjectsEnabled" FROM platform_plan WHERE "platformId" = '<your_platform_id>';
   -- Should return: true
   ```

3. **Via API**:
   ```bash
   curl http://localhost:4200/api/v1/platform \
     -H "Authorization: Bearer <your_token>"
   # Check: plan.manageProjectsEnabled should be true
   ```

## What This Enables

Once enabled, you can:
- ✅ Create multiple projects
- ✅ Switch between projects
- ✅ Manage projects (edit, delete)
- ✅ Invite users to specific projects (with our new project-level invitation system)

## Next Steps

1. Update your existing platform (use Option 1 above - it's the quickest)
2. Restart your server
3. Refresh your browser
4. Go to Platform Settings → Projects
5. You should now see the "New Project" button!

