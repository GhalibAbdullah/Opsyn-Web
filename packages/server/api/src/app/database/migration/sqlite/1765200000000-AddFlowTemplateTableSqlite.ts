import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'

/**
 * Migration to create flow_template table for Community Edition.
 * This table already exists in CLOUD and ENTERPRISE editions.
 */
export class AddFlowTemplateTableSqlite1765200000000 implements MigrationInterface {
    name = 'AddFlowTemplateTableSqlite1765200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Check if table already exists
        const table = await queryRunner.getTable('flow_template')
        if (table) {
            return
        }

        // Create the flow_template table
        await queryRunner.query(`
            CREATE TABLE "flow_template" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "name" varchar NOT NULL,
                "description" varchar NOT NULL,
                "type" varchar NOT NULL,
                "platformId" varchar(21) NOT NULL,
                "projectId" varchar(21),
                "template" text NOT NULL,
                "tags" text NOT NULL,
                "pieces" text NOT NULL,
                "blogUrl" varchar,
                "metadata" text,
                CONSTRAINT "fk_flow_template_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_flow_template_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)

        // Create indices
        await queryRunner.query(`
            CREATE INDEX "idx_flow_template_tags" ON "flow_template" ("tags")
        `)
        await queryRunner.query(`
            CREATE INDEX "idx_flow_template_pieces" ON "flow_template" ("pieces")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Drop indices
        await queryRunner.query('DROP INDEX IF EXISTS "idx_flow_template_pieces"')
        await queryRunner.query('DROP INDEX IF EXISTS "idx_flow_template_tags"')
        
        // Drop table
        await queryRunner.query('DROP TABLE IF EXISTS "flow_template"')
    }
}

