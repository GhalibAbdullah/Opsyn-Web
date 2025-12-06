import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add projectId column to ai_provider table.
 * This makes AI providers project-scoped instead of platform-scoped for security.
 * 
 * IMPORTANT: Existing AI providers will have NULL projectId.
 * Users will need to reconfigure their AI providers per project after this migration.
 */
export class AddProjectIdToAIProvider1769000000000 implements MigrationInterface {
    name = 'AddProjectIdToAIProvider1769000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add projectId column (nullable for existing records)
        await queryRunner.query(`
            ALTER TABLE "ai_provider" 
            ADD COLUMN "projectId" character varying(21)
        `)

        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "ai_provider"
            ADD CONSTRAINT "fk_ai_provider_project_id" 
            FOREIGN KEY ("projectId") REFERENCES "project"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `)

        // Drop old unique index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_ai_provider_platform_id_provider"
        `)

        // Create new unique index with projectId
        // Note: projectId can be NULL for backward compatibility, but new records should have it
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_project_provider" 
            ON "ai_provider" ("platformId", "projectId", "provider")
            WHERE "projectId" IS NOT NULL
        `)

        // Also create index for platform-level providers (backward compatibility)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_provider_null" 
            ON "ai_provider" ("platformId", "provider")
            WHERE "projectId" IS NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_ai_provider_platform_project_provider"
        `)
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_ai_provider_platform_provider_null"
        `)

        // Recreate old unique index
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_id_provider" 
            ON "ai_provider" ("platformId", "provider")
        `)

        // Drop foreign key
        await queryRunner.query(`
            ALTER TABLE "ai_provider" 
            DROP CONSTRAINT IF EXISTS "fk_ai_provider_project_id"
        `)

        // Drop projectId column
        await queryRunner.query(`
            ALTER TABLE "ai_provider" 
            DROP COLUMN IF EXISTS "projectId"
        `)
    }
}

