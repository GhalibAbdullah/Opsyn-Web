import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to add projectRole string column to user_invitation table.
 * This column stores simple role strings ('OWNER' | 'EDITOR' | 'VIEWER') for Community Edition.
 */
export class AddProjectRoleToUserInvitation1768000000000 implements MigrationInterface {
    name = 'AddProjectRoleToUserInvitation1768000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column already exists
        const columnExists = await queryRunner.query(`
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'user_invitation' 
            AND column_name = 'projectRole'
        `)

        if (columnExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "user_invitation" 
                ADD COLUMN "projectRole" character varying(20)
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check if column exists before dropping
        const columnExists = await queryRunner.query(`
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'user_invitation' 
            AND column_name = 'projectRole'
        `)

        if (columnExists.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "user_invitation" 
                DROP COLUMN "projectRole"
            `)
        }
    }
}

