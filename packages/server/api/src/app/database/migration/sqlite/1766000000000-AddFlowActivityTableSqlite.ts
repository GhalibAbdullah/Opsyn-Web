import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class AddFlowActivityTableSqlite1766000000000 implements MigrationInterface {
    name = 'AddFlowActivityTableSqlite1766000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists
        const table = await queryRunner.getTable('flow_activity')
        if (!table) {
            await queryRunner.createTable(
                new Table({
                    name: 'flow_activity',
                    columns: [
                        {
                            name: 'id',
                            type: 'varchar',
                            isPrimary: true,
                        },
                        {
                            name: 'created',
                            type: 'datetime',
                            default: "datetime('now')",
                        },
                        {
                            name: 'updated',
                            type: 'datetime',
                            default: "datetime('now')",
                        },
                        {
                            name: 'projectId',
                            type: 'varchar',
                            isNullable: false,
                        },
                        {
                            name: 'flowId',
                            type: 'varchar',
                            isNullable: false,
                        },
                        {
                            name: 'userId',
                            type: 'varchar',
                            isNullable: true,
                        },
                        {
                            name: 'actionType',
                            type: 'varchar',
                            length: '50',
                            isNullable: false,
                        },
                        {
                            name: 'metadata',
                            type: 'text',
                            isNullable: true,
                        },
                    ],
                }),
                true,
            )
        } else {
            // Table exists, check for missing columns using PRAGMA for accurate info
            const tableInfo = await queryRunner.query(`PRAGMA table_info(flow_activity)`)
            const existingColumnNames = tableInfo.map((col: { name: string }) => col.name)
            
            // Handle old 'action' column - add actionType and copy data
            if (existingColumnNames.includes('action') && !existingColumnNames.includes('actionType')) {
                try {
                    await queryRunner.query(`
                        ALTER TABLE "flow_activity" 
                        ADD COLUMN "actionType" varchar(50) DEFAULT 'UPDATED'
                    `)
                    await queryRunner.query(`
                        UPDATE "flow_activity" 
                        SET "actionType" = COALESCE("action", 'UPDATED')
                    `)
                } catch (error) {
                    // Column might already exist
                }
            }
            
            if (!existingColumnNames.includes('actionType')) {
                try {
                    await queryRunner.query(`
                        ALTER TABLE "flow_activity" 
                        ADD COLUMN "actionType" varchar(50) DEFAULT 'UPDATED'
                    `)
                    await queryRunner.query(`
                        UPDATE "flow_activity" SET "actionType" = 'UPDATED' WHERE "actionType" IS NULL
                    `)
                } catch (error) {
                    const checkInfo = await queryRunner.query(`PRAGMA table_info(flow_activity)`)
                    const hasActionType = checkInfo.some((col: { name: string }) => col.name === 'actionType')
                    if (!hasActionType) {
                        throw error
                    }
                }
            }
            
            if (!existingColumnNames.includes('metadata')) {
                try {
                    await queryRunner.query(`
                        ALTER TABLE "flow_activity" 
                        ADD COLUMN "metadata" text
                    `)
                } catch (error) {
                    // Column might already exist - verify with PRAGMA
                    const checkInfo = await queryRunner.query(`PRAGMA table_info(flow_activity)`)
                    const hasMetadata = checkInfo.some((col: { name: string }) => col.name === 'metadata')
                    if (!hasMetadata) {
                        throw error
                    }
                }
            }
        }

        // Check and create indices only if they don't exist
        const existingIndices = await queryRunner.query(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name IN (
                'idx_flow_activity_flow_id',
                'idx_flow_activity_project_id',
                'idx_flow_activity_created'
            )
        `)
        const existingIndexNames = existingIndices.map((row: { name: string }) => row.name)

        if (!existingIndexNames.includes('idx_flow_activity_flow_id')) {
            await queryRunner.createIndex(
                'flow_activity',
                new TableIndex({
                    name: 'idx_flow_activity_flow_id',
                    columnNames: ['flowId'],
                }),
            )
        }

        if (!existingIndexNames.includes('idx_flow_activity_project_id')) {
            await queryRunner.createIndex(
                'flow_activity',
                new TableIndex({
                    name: 'idx_flow_activity_project_id',
                    columnNames: ['projectId'],
                }),
            )
        }

        if (!existingIndexNames.includes('idx_flow_activity_created')) {
            await queryRunner.createIndex(
                'flow_activity',
                new TableIndex({
                    name: 'idx_flow_activity_created',
                    columnNames: ['created'],
                }),
            )
        }

        // Check and create foreign keys only if they don't exist
        const currentTable = await queryRunner.getTable('flow_activity')
        const existingForeignKeys = currentTable?.foreignKeys.map(fk => fk.name) || []
        
        if (!existingForeignKeys.includes('fk_flow_activity_project_id')) {
            await queryRunner.createForeignKey(
                'flow_activity',
                new TableForeignKey({
                    columnNames: ['projectId'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'project',
                    onDelete: 'CASCADE',
                    name: 'fk_flow_activity_project_id',
                }),
            )
        }

        if (!existingForeignKeys.includes('fk_flow_activity_flow_id')) {
            await queryRunner.createForeignKey(
                'flow_activity',
                new TableForeignKey({
                    columnNames: ['flowId'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'flow',
                    onDelete: 'CASCADE',
                    name: 'fk_flow_activity_flow_id',
                }),
            )
        }

        if (!existingForeignKeys.includes('fk_flow_activity_user_id')) {
            await queryRunner.createForeignKey(
                'flow_activity',
                new TableForeignKey({
                    columnNames: ['userId'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'user',
                    onDelete: 'SET NULL',
                    name: 'fk_flow_activity_user_id',
                }),
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('flow_activity')
    }
}

