import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class AddFlowActivityTable1766000000000 implements MigrationInterface {
    name = 'AddFlowActivityTable1766000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
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
                        type: 'jsonb',
                        isNullable: true,
                    },
                ],
            }),
            true,
        )

        await queryRunner.createIndex(
            'flow_activity',
            new TableIndex({
                name: 'idx_flow_activity_flow_id',
                columnNames: ['flowId'],
            }),
        )

        await queryRunner.createIndex(
            'flow_activity',
            new TableIndex({
                name: 'idx_flow_activity_project_id',
                columnNames: ['projectId'],
            }),
        )

        await queryRunner.createIndex(
            'flow_activity',
            new TableIndex({
                name: 'idx_flow_activity_created',
                columnNames: ['created'],
            }),
        )

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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('flow_activity')
    }
}

