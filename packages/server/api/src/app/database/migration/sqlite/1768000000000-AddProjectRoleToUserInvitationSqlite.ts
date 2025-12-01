import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add projectRole string column to user_invitation table.
 * This column stores simple role strings ('OWNER' | 'EDITOR' | 'VIEWER') for Community Edition.
 */
export class AddProjectRoleToUserInvitationSqlite1768000000000 implements MigrationInterface {
    name = 'AddProjectRoleToUserInvitationSqlite1768000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column already exists
        const table = await queryRunner.query(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='user_invitation'
        `)

        if (table.length > 0 && !table[0].sql.includes('projectRole')) {
            await queryRunner.query(`
                ALTER TABLE "user_invitation" 
                ADD COLUMN "projectRole" varchar(20)
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        // This is a simplified rollback - in practice, you'd need to preserve data
        await queryRunner.query(`
            CREATE TABLE "user_invitation_backup" AS 
            SELECT * FROM "user_invitation"
        `)
        
        await queryRunner.query(`DROP TABLE "user_invitation"`)
        
        await queryRunner.query(`
            CREATE TABLE "user_invitation" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "platformId" varchar NOT NULL,
                "type" varchar NOT NULL,
                "platformRole" varchar,
                "email" varchar NOT NULL,
                "projectId" varchar,
                "status" varchar NOT NULL,
                "projectRoleId" varchar
            )
        `)
        
        await queryRunner.query(`
            INSERT INTO "user_invitation" 
            SELECT id, created, updated, platformId, type, platformRole, email, projectId, status, projectRoleId
            FROM "user_invitation_backup"
        `)
        
        await queryRunner.query(`DROP TABLE "user_invitation_backup"`)
        
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_user_invitation_email_platform_project" 
            ON "user_invitation" ("email", "platformId", "projectId")
        `)
    }
}

