import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFlowActivityTableSqlite1763000000000 implements MigrationInterface {
    name = 'AddFlowActivityTableSqlite1763000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "flow_activity" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "flowId" varchar(21) NOT NULL,
                "projectId" varchar(21) NOT NULL,
                "userId" varchar(21),
                "action" varchar NOT NULL,
                "operationType" varchar,
                "message" varchar NOT NULL,
                "details" text,
                CONSTRAINT "fk_flow_activity_flow_id" FOREIGN KEY ("flowId") REFERENCES "flow" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_flow_activity_user_id" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query(`
            CREATE INDEX "idx_flow_activity_flow_id_created_desc" ON "flow_activity" ("flowId", "created" DESC)
        `)
        await queryRunner.query(`
            CREATE INDEX "idx_flow_activity_project_id" ON "flow_activity" ("projectId")
        `)
        await queryRunner.query(`
            CREATE INDEX "idx_flow_activity_user_id" ON "flow_activity" ("userId")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "idx_flow_activity_user_id"
        `)
        await queryRunner.query(`
            DROP INDEX "idx_flow_activity_project_id"
        `)
        await queryRunner.query(`
            DROP INDEX "idx_flow_activity_flow_id_created_desc"
        `)
        await queryRunner.query(`
            DROP TABLE "flow_activity"
        `)
    }
}

