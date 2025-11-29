import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPasswordResetOtpEntitySQLITE1735000000001 implements MigrationInterface {
    name = 'AddPasswordResetOtpEntitySQLITE1735000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "password_reset_otp" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "identityId" varchar(21) NOT NULL,
                "value" varchar NOT NULL,
                "state" varchar NOT NULL,
                CONSTRAINT "fk_password_reset_otp_identity_id" FOREIGN KEY ("identityId") REFERENCES "user_identity" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_password_reset_otp_identity_id" ON "password_reset_otp" ("identityId")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "idx_password_reset_otp_identity_id"
        `)
        await queryRunner.query(`
            DROP TABLE "password_reset_otp"
        `)
    }
}

