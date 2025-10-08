import { Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { prisma } from '../plugins/prisma.js';
import { env } from '../config/env.js';
import fetch from 'node-fetch';

type TtsBatchPayload = {
  jobId: string;
  pdfId: string;
  voiceModelId: string;
  userId: string;
};

export const handleTtsBatchJob = async (job: Job<TtsBatchPayload>, app: FastifyInstance) => {
  const { pdfId, voiceModelId, userId } = job.data;
  await prisma.ttsJob.update({
    where: { id: job.data.jobId },
    data: { status: 'processing', progress: 0.05 }
  });

  // W praktyce pobieramy segmenty PDF i wysyłamy do mikroserwisu TTS.
  const segments = await prisma.pdfSegment.findMany({
    where: { pdfId },
    orderBy: { order: 'asc' }
  });

  let progress = 0.1;
  for (const segment of segments) {
    progress += 0.8 / Math.max(segments.length, 1);
    await fetch(`${env.ttsServiceUrl}/tts/${voiceModelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: segment.text, metadata: { pdfId, segmentId: segment.id } })
    });
    await prisma.ttsJob.update({
      where: { id: job.data.jobId },
      data: { progress }
    });
  }

  await prisma.ttsJob.update({
    where: { id: job.data.jobId },
    data: { status: 'done', progress: 1, resultKey: `tts/${userId}/${job.data.jobId}.mp3` }
  });
  app.log.info({ jobId: job.id }, 'Zadanie TTS zakończone');
};
