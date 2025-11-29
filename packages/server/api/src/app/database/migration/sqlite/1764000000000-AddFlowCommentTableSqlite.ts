import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowCommentTableSqlite1764000000000 implements MigrationInterface {
    name = 'AddFlowCommentTableSqlite1764000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "flow_comment" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "flowId" varchar(21) NOT NULL,
                "userId" varchar(21),
                "content" text NOT NULL,
                "stepName" varchar,
                "parentCommentId" varchar(21),
                CONSTRAINT "fk_flow_comment_flow_id" FOREIGN KEY ("flowId") REFERENCES "flow" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_flow_comment_user_id" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
                CONSTRAINT "fk_flow_comment_parent_id" FOREIGN KEY ("parentCommentId") REFERENCES "flow_comment" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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

