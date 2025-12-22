/**
 * OPSYN Module
 * 
 * Workflow generation from natural language prompts.
 */

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { opsynController } from './opsyn.controller';

export const opsynModule: FastifyPluginAsyncTypebox = async (app) => {
  await app.register(opsynController, { prefix: '/v1/opsyn' });
};

