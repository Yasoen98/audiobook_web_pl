import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { getQueues } from '../../queues/index.js';

const ttsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized();
    }
  });

  app.post('/stream', async (request) => {
    const { pdfId, voiceModelId } = request.body as { pdfId: string; voiceModelId: string };
    const userId = (request.user as any).sub;
    const job = await prisma.ttsJob.create({
      data: {
        userId,
        pdfId,
        voiceModelId,
        type: 'stream',
        status: 'processing',
        progress: 0.1
      }
    });
    return { jobId: job.id, message: 'Streaming zostanie uruchomiony przez SSE/WebSocket' };
  });

  app.post('/batch', async (request) => {
    const { pdfId, voiceModelId } = request.body as { pdfId: string; voiceModelId: string };
    const userId = (request.user as any).sub;
    const job = await prisma.ttsJob.create({
      data: {
        userId,
        pdfId,
        voiceModelId,
        type: 'batch',
        status: 'queued'
      }
    });
    const queues = getQueues();
    await queues.ttsBatchQueue.add('batch', {
      jobId: job.id,
      pdfId,
      voiceModelId,
      userId
    });
    return { jobId: job.id };
  });

  app.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await prisma.ttsJob.findUnique({ where: { id } });
    if (!job) {
      return reply.notFound('Zadanie nie istnieje');
    }
    return job;
  });
};

export default ttsRoutes;
