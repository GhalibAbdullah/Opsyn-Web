import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFlowActivityTable1763000000000 implements MigrationInterface {
    name = 'AddFlowActivityTable1763000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "flow_activity" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "flowId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "userId" character varying(21),
                "action" character varying NOT NULL,
                "operationType" character varying,
                "message" character varying NOT NULL,
                "details" jsonb,
                CONSTRAINT "PK_flow_activity_id" PRIMARY KEY ("id")
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
        await queryRunner.query(`
            ALTER TABLE "flow_activity" ADD CONSTRAINT "fk_flow_activity_flow_id" FOREIGN KEY ("flowId") REFERENCES "flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `)
        await queryRunner.query(`
            ALTER TABLE "flow_activity" ADD CONSTRAINT "fk_flow_activity_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_activity" DROP CONSTRAINT "fk_flow_activity_user_id"
        `)
        await queryRunner.query(`
            ALTER TABLE "flow_activity" DROP CONSTRAINT "fk_flow_activity_flow_id"
        `)
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

