import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add projectId column to ai_provider table (SQLite).
 * This makes AI providers project-scoped instead of platform-scoped for security.
 * 
 * IMPORTANT: Existing AI providers will have NULL projectId.
 * Users will need to reconfigure their AI providers per project after this migration.
 */
export class AddProjectIdToAIProviderSqlite1769000000000 implements MigrationInterface {
    name = 'AddProjectIdToAIProviderSqlite1769000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support adding NOT NULL columns easily, so we add it as nullable
        await queryRunner.query(`
            ALTER TABLE "ai_provider" 
            ADD COLUMN "projectId" varchar(21)
        `)

        // Drop old unique index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_ai_provider_platform_id_provider"
        `)

        // SQLite doesn't support partial unique indexes with WHERE clauses in ON CONFLICT
        // So we need to create a unique constraint that works for both cases
        // We'll create a unique index on (platformId, provider, projectId)
        // SQLite treats NULL as distinct, so this allows multiple NULL projectIds per (platformId, provider)
        // But we need to handle the uniqueness logic in application code
        // For now, create a simple unique index that TypeORM can use for ON CONFLICT
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_project_provider" 
            ON "ai_provider" ("platformId", "projectId", "provider")
        `)

        // Add foreign key constraint (SQLite supports this in newer versions)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ai_provider_project_id" 
            ON "ai_provider" ("projectId")
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
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_ai_provider_project_id"
        `)

        // Recreate old unique index
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_id_provider" 
            ON "ai_provider" ("platformId", "provider")
        `)

        // SQLite doesn't support DROP COLUMN easily, so we'll need to recreate the table
        // This is a simplified version - in production you'd want a more careful migration
        await queryRunner.query(`
            CREATE TABLE "ai_provider_backup" AS 
            SELECT "id", "created", "updated", "platformId", "config", "provider"
            FROM "ai_provider"
        `)
        
        await queryRunner.query(`DROP TABLE "ai_provider"`)
        
        await queryRunner.query(`
            CREATE TABLE "ai_provider" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "platformId" varchar NOT NULL,
                "config" text NOT NULL,
                "provider" varchar NOT NULL,
                CONSTRAINT "fk_ai_provider_platform_id" 
                FOREIGN KEY ("platformId") REFERENCES "platform"("id") 
                ON DELETE CASCADE
            )
        `)
        
        await queryRunner.query(`
            INSERT INTO "ai_provider" 
            SELECT "id", "created", "updated", "platformId", "config", "provider"
            FROM "ai_provider_backup"
        `)
        
        await queryRunner.query(`DROP TABLE "ai_provider_backup"`)
        
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_ai_provider_platform_id_provider" 
            ON "ai_provider" ("platformId", "provider")
        `)
    }
}

