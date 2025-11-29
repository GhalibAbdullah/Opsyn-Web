import { MigrationInterface, QueryRunner } from 'typeorm';
import { system } from '../../../helper/system/system';
import { ApEdition } from '@activepieces/shared';

export class AddProjectMemberTable1765000000000 implements MigrationInterface {
    name = 'AddProjectMemberTable1765000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Only run for Community Edition
        const edition = system.getEdition();
        if (edition !== ApEdition.COMMUNITY) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE "project_member" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "projectId" character varying(21) NOT NULL,
                "platformId" character varying(21) NOT NULL,
                "userId" character varying(21) NOT NULL,
                "role" character varying(20) NOT NULL,
                CONSTRAINT "PK_project_member_id" PRIMARY KEY ("id")
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
        
        await queryRunner.query(`
            ALTER TABLE "project_member" ADD CONSTRAINT "fk_project_member_project_id" 
            FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        
        await queryRunner.query(`
            ALTER TABLE "project_member" ADD CONSTRAINT "fk_project_member_user_id" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
            ALTER TABLE "project_member" DROP CONSTRAINT "fk_project_member_user_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "project_member" DROP CONSTRAINT "fk_project_member_project_id"
        `);
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

