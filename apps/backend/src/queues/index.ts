import { FastifyInstance } from 'fastify';
import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { createBullMQConnection } from '../utils/redis.js';
import { handleTtsBatchJob } from './ttsBatch.js';

export interface QueueRegistry {
  ttsBatchQueue: Queue;
}

let registry: QueueRegistry | null = null;

export const registerQueues = async (app: FastifyInstance) => {
  if (registry) {
    return registry;
  }
  const connection = createBullMQConnection(env.redisUrl);
  const ttsBatchQueue = new Queue('tts-batch', { connection });

  new Worker(
    'tts-batch',
    async (job) => {
      app.log.info({ jobId: job.id }, 'Przetwarzanie zadania batch TTS');
      await handleTtsBatchJob(job, app);
    },
    { connection }
  );

  registry = { ttsBatchQueue };
  app.decorate('queues', registry);
  return registry;
};

export const getQueues = (): QueueRegistry => {
  if (!registry) {
    throw new Error('Kolejki nie zostały zainicjalizowane');
  }
  return registry;
};
