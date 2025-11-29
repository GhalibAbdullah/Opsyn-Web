import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowCommentTable1764000000000 implements MigrationInterface {
    name = 'AddFlowCommentTable1764000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "flow_comment" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "flowId" character varying(21) NOT NULL,
                "userId" character varying(21),
                "content" text NOT NULL,
                "stepName" character varying,
                "parentCommentId" character varying(21),
                CONSTRAINT "PK_flow_comment_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_flow_comment_flow_id" ON "flow_comment" ("flowId")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_flow_comment_step_name" ON "flow_comment" ("stepName")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_flow_comment_user_id" ON "flow_comment" ("userId")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_flow_comment_parent_id" ON "flow_comment" ("parentCommentId")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_flow_comment_flow_id_created" ON "flow_comment" ("flowId", "created")
        `);
        await queryRunner.query(`
            ALTER TABLE "flow_comment" ADD CONSTRAINT "fk_flow_comment_flow_id" FOREIGN KEY ("flowId") REFERENCES "flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "flow_comment" ADD CONSTRAINT "fk_flow_comment_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "flow_comment" ADD CONSTRAINT "fk_flow_comment_parent_id" FOREIGN KEY ("parentCommentId") REFERENCES "flow_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_comment" DROP CONSTRAINT "fk_flow_comment_parent_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "flow_comment" DROP CONSTRAINT "fk_flow_comment_user_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "flow_comment" DROP CONSTRAINT "fk_flow_comment_flow_id"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_flow_comment_flow_id_created"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_flow_comment_parent_id"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_flow_comment_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_flow_comment_step_name"
        `);
        await queryRunner.query(`
            DROP INDEX "idx_flow_comment_flow_id"
        `);
        await queryRunner.query(`
            DROP TABLE "flow_comment"
        `);
    }
}

