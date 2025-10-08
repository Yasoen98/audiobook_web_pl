import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { voiceModelCreateSchema } from '@polski-lektor-ai/shared';
import fetch from 'node-fetch';
import { env } from '../../config/env.js';

const voiceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized();
    }
  });

  app.get('/', async (request) => {
    const userId = (request.user as any).sub;
    return prisma.voiceModel.findMany({ where: { userId } });
  });

  app.get('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const vm = await prisma.voiceModel.findUnique({ where: { id } });
    if (!vm) {
      return reply.notFound('Model nie istnieje');
    }
    return vm;
  });

  app.post('/', async (request) => {
    const body = voiceModelCreateSchema.parse(request.body);
    const userId = (request.user as any).sub;
    return prisma.voiceModel.create({
      data: {
        userId,
        name: body.name,
        architecture: body.architecture,
        watermarkEnabled: body.watermarkEnabled
      }
    });
  });

  app.post('/:id/train', async (request, reply) => {
    const { id } = request.params as { id: string };
    const vm = await prisma.voiceModel.findUnique({ where: { id } });
    if (!vm) {
      return reply.notFound('Model nie istnieje');
    }
    await prisma.voiceModel.update({
      where: { id },
      data: { status: 'training' }
    });
    // Wysyłamy prośbę do mikroserwisu o rozpoczęcie treningu
    await fetch(`${env.ttsServiceUrl}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: id, architecture: vm.architecture, epochs: 5 })
    });
    return { ok: true };
  });

  app.post('/:id/samples', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.badRequest('Brak pliku');
    }
    // TODO: obsługa próbek audio z walidacją i zapisem do S3
    return { ok: true };
  });
};

export default voiceRoutes;
