import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyHelmet from 'fastify-helmet';
import fastifyMultipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from 'fastify-swagger';
import fastifySensible from '@fastify/sensible';
import { env } from './config/env.js';
import { prisma } from './plugins/prisma.js';
import { registerRoutes } from './routes/index.js';
import { registerQueues } from './queues/index.js';

const server = Fastify({
  logger: true
});

await server.register(fastifySensible);
await server.register(fastifyCors, {
  origin: env.host,
  credentials: true
});
await server.register(fastifyCookie, {
  hook: 'onRequest',
  parseOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
});
await server.register(fastifyJwt, {
  secret: env.jwtSecret,
  cookie: {
    cookieName: 'plai_token',
    signed: false
  }
});
await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});
await server.register(fastifyMultipart, {
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});
await server.register(fastifyHelmet, {
  global: true,
  contentSecurityPolicy: {
    useDefaults: true,
    reportOnly: env.cspReportOnly
  }
});
await server.register(fastifySwagger, {
  exposeRoute: true,
  routePrefix: '/docs',
  swagger: {
    info: {
      title: 'Polski Lektor AI API',
      version: '0.1.0'
    }
  }
});

await registerQueues(server);
await registerRoutes(server);

server.addHook('onClose', async () => {
  await prisma.$disconnect();
});

server.listen({ port: env.port, host: env.host }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
