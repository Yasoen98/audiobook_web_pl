import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    try {
      const payload = await request.jwtVerify();
      if ((payload as any).role !== 'admin') {
        return reply.forbidden('Brak uprawnień');
      }
    } catch {
      return reply.unauthorized();
    }
  });

  app.get('/users', async () => {
    return prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true }
    });
  });

  app.get('/logs', async () => {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  });
};

export default adminRoutes;
