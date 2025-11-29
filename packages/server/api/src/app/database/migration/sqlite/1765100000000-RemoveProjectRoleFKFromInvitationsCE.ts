import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm'
import { system } from '../../../helper/system/system'

/**
 * Migration to remove projectRoleId foreign key constraint in Community Edition.
 * In CE, we store role names directly in projectRoleId (not UUIDs from project_role table),
 * so the foreign key constraint causes errors.
 */
export class RemoveProjectRoleFKFromInvitationsCE1765100000000 implements MigrationInterface {
    name = 'RemoveProjectRoleFKFromInvitationsCE1765100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // SQLite doesn't support DROP CONSTRAINT directly
        // We need to recreate the table without the foreign key constraint
        // First, disable foreign key checks
        await queryRunner.query('PRAGMA foreign_keys = OFF')

        // Get the current table structure
        const table = await queryRunner.getTable('user_invitation')
        if (!table) {
            await queryRunner.query('PRAGMA foreign_keys = ON')
            return
        }

        // Check if projectRoleId FK exists
        const hasProjectRoleFK = table.foreignKeys.some(
            fk => fk.columnNames.includes('projectRoleId')
        )

        if (!hasProjectRoleFK) {
            // No FK to remove, re-enable foreign keys and return
            await queryRunner.query('PRAGMA foreign_keys = ON')
            return
        }

        // Create new table without the projectRoleId foreign key
        // Column order must match the old table structure
        await queryRunner.query(`
            CREATE TABLE "user_invitation_new" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "platformId" varchar(21) NOT NULL,
                "type" varchar NOT NULL,
                "platformRole" varchar,
                "projectId" varchar(21),
                "projectRoleId" varchar,
                "status" varchar NOT NULL,
                "email" varchar NOT NULL,
                CONSTRAINT "fk_user_invitation_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE
            )
        `)

        // Copy data from old table to new table
        // Explicitly specify columns to ensure correct mapping
        await queryRunner.query(`
            INSERT INTO "user_invitation_new" (
                "id",
                "created",
                "updated",
                "platformId",
                "type",
                "platformRole",
                "projectId",
                "projectRoleId",
                "status",
                "email"
            )
            SELECT 
                "id",
                "created",
                "updated",
                "platformId",
                "type",
                "platformRole",
                "projectId",
                "projectRoleId",
                "status",
                "email"
            FROM "user_invitation"
        `)

        // Drop old table
        await queryRunner.query('DROP TABLE "user_invitation"')

        // Rename new table
        await queryRunner.query('ALTER TABLE "user_invitation_new" RENAME TO "user_invitation"')

        // Recreate the unique index
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_user_invitation_email_platform_project" 
            ON "user_invitation" ("email", "platformId", "projectId")
        `)

        // Re-enable foreign key checks
        await queryRunner.query('PRAGMA foreign_keys = ON')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Note: We don't recreate the FK in rollback because:
        // 1. CE doesn't have project_role table
        // 2. The constraint would fail in CE
        // This is intentional - CE should not have this FK
    }
}

