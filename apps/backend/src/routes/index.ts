import { FastifyInstance } from 'fastify';
import authRoutes from './modules/auth.js';
import voiceRoutes from './modules/voice.js';
import pdfRoutes from './modules/pdf.js';
import ttsRoutes from './modules/tts.js';
import adminRoutes from './modules/admin.js';

export const registerRoutes = async (app: FastifyInstance) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(voiceRoutes, { prefix: '/voice-models' });
  await app.register(pdfRoutes, { prefix: '/pdf' });
  await app.register(ttsRoutes, { prefix: '/tts' });
  await app.register(adminRoutes, { prefix: '/admin' });
};
