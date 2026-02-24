import { Project } from '@activepieces/shared'
import { hooksFactory } from '../helper/hooks-factory'

export type ProjectHooks = {
    postCreate(project: Project): Promise<void>
}

export const projectHooks = hooksFactory.create<ProjectHooks>(_log => ({
    postCreate: async (project: Project) => {
        const { projectMemberService } = await import('../project-members/project-member.service')
        await projectMemberService(_log).create({
            projectId: project.id,
            userId: project.ownerId,
            role: 'OWNER',
        })
    },
}))