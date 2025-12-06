import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'

const log = system.globalLogger()

export class PiecesProjectLimitsSqlite1712279318441 implements MigrationInterface {
    name = 'PiecesProjectLimitsSqlite1712279318441'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        const tableExists = await queryRunner.hasTable('project_plan')
        
        // For Community Edition, create the table if it doesn't exist
        if (edition === ApEdition.COMMUNITY && !tableExists) {
            log.info({ name: 'PiecesProjectLimitsSqlite1712279318441' }, 'Creating project_plan table for Community Edition (SQLite)')
            await queryRunner.query(`
                CREATE TABLE "project_plan" (
                    "id" varchar(21) PRIMARY KEY NOT NULL,
                    "created" datetime NOT NULL DEFAULT (datetime('now')),
                    "updated" datetime NOT NULL DEFAULT (datetime('now')),
                    "projectId" varchar(21) NOT NULL,
                    "name" varchar NOT NULL,
                    "pieces" text NOT NULL DEFAULT '[]',
                    "piecesFilterType" varchar NOT NULL DEFAULT 'NONE',
                    "locked" boolean NOT NULL DEFAULT 0,
                    "aiCredits" integer,
                    CONSTRAINT "REL_4f52e89612966d95843e4158bb" UNIQUE ("projectId"),
                    CONSTRAINT "fk_project_plan_project_id" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `)
            await queryRunner.query(`
                CREATE UNIQUE INDEX "idx_plan_project_id" ON "project_plan" ("projectId")
            `)
            return
        }
        
        // For Enterprise/Cloud, modify existing table if it exists
        if (edition !== ApEdition.COMMUNITY) {
            if (!tableExists) {
                log.warn({ name: 'PiecesProjectLimitsSqlite1712279318441' }, 'project_plan table does not exist, skipping migration')
                return
            }
            
            // Check if columns already exist before adding them
            const hasPieces = await queryRunner.query(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='project_plan'
            `)
            
            if (hasPieces.length > 0) {
                // Check if pieces column exists
                const tableInfo = await queryRunner.query(`PRAGMA table_info(project_plan)`)
                const hasPiecesColumn = tableInfo.some((col: any) => col.name === 'pieces')
                const hasPiecesFilterTypeColumn = tableInfo.some((col: any) => col.name === 'piecesFilterType')
                
                if (!hasPiecesColumn) {
                    await queryRunner.query(`
                        ALTER TABLE "project_plan" ADD COLUMN "pieces" text NOT NULL DEFAULT '[]'
                    `)
                }
                
                if (!hasPiecesFilterTypeColumn) {
                    await queryRunner.query(`
                        ALTER TABLE "project_plan" ADD COLUMN "piecesFilterType" varchar NOT NULL DEFAULT 'NONE'
                    `)
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        if (edition === ApEdition.COMMUNITY) {
            const tableExists = await queryRunner.hasTable('project_plan')
            if (tableExists) {
                await queryRunner.query(`DROP TABLE "project_plan"`)
            }
        } else {
            // For Enterprise/Cloud, remove the columns we added
            const tableExists = await queryRunner.hasTable('project_plan')
            if (tableExists) {
                // SQLite doesn't support DROP COLUMN directly, so we'd need to recreate the table
                // For now, we'll just log a warning
                log.warn({ name: 'PiecesProjectLimitsSqlite1712279318441' }, 'SQLite does not support DROP COLUMN, manual migration may be required')
            }
        }
    }
}

