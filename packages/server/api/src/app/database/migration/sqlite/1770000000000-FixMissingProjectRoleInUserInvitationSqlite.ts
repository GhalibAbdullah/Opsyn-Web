import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to reliably ensure projectRole column exists in user_invitation table.
 * Previous migrations had a name collision with projectRoleId that caused this column to be skipped.
 */
export class FixMissingProjectRoleInUserInvitationSqlite1770000000000 implements MigrationInterface {
    name = 'FixMissingProjectRoleInUserInvitationSqlite1770000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column exists using PRAGMA for reliability
        const columns = await queryRunner.query('PRAGMA table_info("user_invitation")')
        const hasProjectRole = columns.some((column: any) => column.name === 'projectRole')

        if (!hasProjectRole) {
            await queryRunner.query(`
                ALTER TABLE "user_invitation" 
                ADD COLUMN "projectRole" varchar(20)
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration as this is a reliability fix
    }
}
