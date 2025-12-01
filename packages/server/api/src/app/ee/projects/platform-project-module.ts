import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { projectWorkerController } from '../../project/project-worker-controller'
import { platformProjectController } from './platform-project-controller'
import { usersProjectController } from './platform-user-project-controller'

export const platformProjectModule: FastifyPluginAsyncTypebox = async (app) => {
    app.log.info('Registering platformProjectModule')
    await app.register(platformProjectController, { prefix: '/v1/projects' })
    app.log.info('Registering usersProjectController with prefix /v1/users/projects')
    await app.register(usersProjectController, { prefix: '/v1/users/projects' })
    await app.register(projectWorkerController, { prefix: '/v1/worker/project' })
    app.log.info('platformProjectModule registration complete')
}
