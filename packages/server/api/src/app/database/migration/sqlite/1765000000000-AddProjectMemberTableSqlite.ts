import { MigrationInterface, QueryRunner } from 'typeorm';
import { system } from '../../../helper/system/system';
import { ApEdition } from '@activepieces/shared';

export class AddProjectMemberTableSqlite1765000000000 implements MigrationInterface {
    name = 'AddProjectMemberTableSqlite1765000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Only run for Community Edition
        const edition = system.getEdition();
        if (edition !== ApEdition.COMMUNITY) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE "project_member" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "projectId" varchar(21) NOT NULL,
                "platformId" varchar(21) NOT NULL,
                "userId" varchar(21) NOT NULL,
                "role" varchar(20) NOT NULL,
                CONSTRAINT "fk_project_member_project_id" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_project_member_user_id" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_project_member_project_id_user_id_platform_id" 
            ON "project_member" ("projectId", "userId", "platformId")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "idx_project_member_project_id" ON "project_member" ("projectId")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "idx_project_member_user_id" ON "project_member" ("userId")
        `);

        // Migrate existing platform admins to project members with EDITOR role
        // Note: This migration will be run after the table is created, so we can use a simple approach
        // The actual migration of existing users should be handled by application logic or a separate migration
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition();
        if (edition !== ApEdition.COMMUNITY) {
            return;
        }

        await queryRunner.query(`
            DROP INDEX "idx_project_member_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_project_member_project_id"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_project_member_project_id_user_id_platform_id"
        `);
        await queryRunner.query(`
            DROP TABLE "project_member"
        `);
    }
}

