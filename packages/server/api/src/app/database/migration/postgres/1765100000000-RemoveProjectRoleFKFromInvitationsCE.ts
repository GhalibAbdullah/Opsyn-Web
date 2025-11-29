import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'

/**
 * Migration to remove projectRoleId foreign key constraint in Community Edition.
 * In CE, we store role names directly in projectRoleId (not UUIDs from project_role table),
 * so the foreign key constraint causes errors.
 */
export class RemoveProjectRoleFKFromInvitationsCE1765100000000 implements MigrationInterface {
    name = 'RemoveProjectRoleFKFromInvitationsCE1765100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Drop the foreign key constraint if it exists
        const fkExists = await queryRunner.query(`
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_user_invitation_project_role_id'
            AND table_name = 'user_invitation'
        `)

        if (fkExists.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "user_invitation" 
                DROP CONSTRAINT IF EXISTS "fk_user_invitation_project_role_id"
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Note: We don't recreate the FK in rollback because:
        // 1. CE doesn't have project_role table
        // 2. The constraint would fail in CE
        // This is intentional - CE should not have this FK
    }
}

