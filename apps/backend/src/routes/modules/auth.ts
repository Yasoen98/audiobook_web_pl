import { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { prisma } from '../../plugins/prisma.js';
import { registerSchema, loginSchema } from '@polski-lektor-ai/shared';
import { env } from '../../config/env.js';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', {
    schema: {
      summary: 'Rejestracja nowego użytkownika'
    }
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.badRequest('Użytkownik już istnieje');
    }
    const passwordHash = await argon2.hash(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        consents: {
          createMany: {
            data: [
              { text: 'To mój głos' },
              { text: 'Akceptuję regulamin' },
              { text: 'Nie będę używać do podszywania się' }
            ]
          }
        }
      }
    });
    reply.setCookie('plai_token', await reply.jwtSign({ sub: user.id }), {
      httpOnly: true,
      sameSite: 'lax'
    });
    return { id: user.id, email: user.email };
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return reply.unauthorized('Nieprawidłowe dane logowania');
    }
    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      return reply.unauthorized('Nieprawidłowe dane logowania');
    }

    const token = await reply.jwtSign({ sub: user.id, role: user.role });
    reply.setCookie('plai_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    const refreshToken = await reply.jwtSign({ sub: user.id, type: 'refresh' }, {
      expiresIn: '7d',
      secret: env.jwtRefreshSecret
    });
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
      }
    });
    reply.setCookie('plai_refresh', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    return { id: user.id, email: user.email, role: user.role };
  });

  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.plai_refresh;
    if (!refreshToken) {
      return reply.unauthorized();
    }
    try {
      const payload = await app.jwt.verify(refreshToken, { secret: env.jwtRefreshSecret });
      const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
      if (!stored) {
        return reply.unauthorized();
      }
      const token = await reply.jwtSign({ sub: payload.sub });
      reply.setCookie('plai_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false
      });
      return { ok: true };
    } catch (error) {
      request.log.error(error, 'Nie udało się odświeżyć tokenu');
      return reply.unauthorized();
    }
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie('plai_token');
    reply.clearCookie('plai_refresh');
    return { ok: true };
  });
};

export default authRoutes;
