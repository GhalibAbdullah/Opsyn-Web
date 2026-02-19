import { DefaultProjectRole, Permission, ProjectRole, RoleType } from '@activepieces/shared'
import { repoFactory } from '../../core/db/repo-factory'
import { system } from '../../helper/system/system'
import { DataSeed } from './data-seed'

const rolePermissions: Record<DefaultProjectRole, Permission[]> = {
    [DefaultProjectRole.ADMIN]: [
        Permission.READ_APP_CONNECTION,
        Permission.WRITE_APP_CONNECTION,
        Permission.READ_FLOW,
        Permission.WRITE_FLOW,
        Permission.UPDATE_FLOW_STATUS,
        Permission.READ_PROJECT_MEMBER,
        Permission.WRITE_PROJECT_MEMBER,
        Permission.WRITE_INVITATION,
        Permission.READ_INVITATION,
        Permission.WRITE_PROJECT_RELEASE,
        Permission.READ_PROJECT_RELEASE,
        Permission.READ_RUN,
        Permission.WRITE_RUN,
        Permission.WRITE_ALERT,
        Permission.READ_ALERT,
        Permission.WRITE_PROJECT,
        Permission.READ_PROJECT,
        Permission.WRITE_FOLDER,
        Permission.READ_FOLDER,
        Permission.READ_TODOS,
        Permission.WRITE_TODOS,
        Permission.READ_TABLE,
        Permission.WRITE_TABLE,
        Permission.READ_MCP,
        Permission.WRITE_MCP,
    ],
    [DefaultProjectRole.EDITOR]: [
        Permission.READ_APP_CONNECTION,
        Permission.WRITE_APP_CONNECTION,
        Permission.READ_FLOW,
        Permission.WRITE_FLOW,
        Permission.UPDATE_FLOW_STATUS,
        Permission.READ_PROJECT_MEMBER,
        Permission.READ_INVITATION,
        Permission.WRITE_PROJECT_RELEASE,
        Permission.READ_PROJECT_RELEASE,
        Permission.READ_RUN,
        Permission.WRITE_RUN,
        Permission.READ_PROJECT,
        Permission.WRITE_FOLDER,
        Permission.READ_FOLDER,
        Permission.READ_TODOS,
        Permission.WRITE_TODOS,
        Permission.READ_TABLE,
        Permission.WRITE_TABLE,
        Permission.READ_MCP,
        Permission.WRITE_MCP,
    ],
    [DefaultProjectRole.OPERATOR]: [
        Permission.READ_APP_CONNECTION,
        Permission.WRITE_APP_CONNECTION,
        Permission.READ_FLOW,
        Permission.UPDATE_FLOW_STATUS,
        Permission.READ_PROJECT_MEMBER,
        Permission.READ_INVITATION,
        Permission.READ_PROJECT_RELEASE,
        Permission.READ_RUN,
        Permission.WRITE_RUN,
        Permission.READ_PROJECT,
        Permission.READ_FOLDER,
        Permission.READ_TODOS,
        Permission.WRITE_TODOS,
        Permission.READ_TABLE,
        Permission.READ_MCP,
    ],
    [DefaultProjectRole.VIEWER]: [
        Permission.READ_APP_CONNECTION,
        Permission.READ_FLOW,
        Permission.READ_PROJECT_MEMBER,
        Permission.READ_INVITATION,
        Permission.READ_PROJECT,
        Permission.READ_RUN,
        Permission.READ_FOLDER,
        Permission.READ_TODOS,
        Permission.READ_TABLE,
        Permission.READ_MCP,
    ],
}

import { ProjectRoleEntity } from '../entity/project-role-entity'

const roleIds: Record<DefaultProjectRole, string> = {
    [DefaultProjectRole.ADMIN]: '461ueYHzMykyk5dIL8HzQ',
    [DefaultProjectRole.EDITOR]: 'sjWe85TwaFYxyhn2AgOha',
    [DefaultProjectRole.OPERATOR]: '3Wl9IAw5aM0HLafHgMYkb',
    [DefaultProjectRole.VIEWER]: 'aJVBSSJ3YqZ7r1laFjM0a',
}

export const rolesSeed: DataSeed = {
    run: async () => {
        system.globalLogger().info({ name: 'rolesSeed' }, 'Seeding roles')
        const projectMemberRoleRepo = repoFactory(ProjectRoleEntity)
        for (const role of Object.values(DefaultProjectRole)) {
            const permissions = rolePermissions[role]
            const projectRole: Omit<ProjectRole, 'created' | 'updated'> = {
                name: role,
                permissions,
                type: RoleType.DEFAULT,
                id: roleIds[role],
            }
            await projectMemberRoleRepo().upsert(projectRole, ['id'])
        }
    },
}