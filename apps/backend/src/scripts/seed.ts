import { prisma } from '../plugins/prisma.js';
import argon2 from 'argon2';

async function main() {
  const demoPassword = await argon2.hash('Demo!1234');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@lektor.ai' },
    update: {},
    create: {
      email: 'demo@lektor.ai',
      passwordHash: demoPassword,
      voiceModels: {
        create: [{
          name: 'Domyślny lektor',
          status: 'ready',
          samplesCount: 10,
          sampleRate: 22050,
          architecture: 'vits'
        }]
      }
    }
  });

  const pdf = await prisma.pdfFile.upsert({
    where: { hash: 'demo-hash' },
    update: {},
    create: {
      userId: demoUser.id,
      title: 'Przykładowy PDF',
      originalName: 'demo.pdf',
      storageKey: 'pdf/demo.pdf',
      sizeBytes: 1024,
      pageCount: 2,
      tags: ['demo'],
      hash: 'demo-hash'
    }
  });

  await prisma.pdfSegment.createMany({
    data: [
      {
        pdfId: pdf.id,
        page: 1,
        order: 0,
        text: 'To jest przykładowe zdanie po polsku.',
        startChar: 0,
        endChar: 36
      },
      {
        pdfId: pdf.id,
        page: 1,
        order: 1,
        text: 'Drugie zdanie demonstruje działanie segmentacji.',
        startChar: 37,
        endChar: 87
      }
    ],
    skipDuplicates: true
  });

  console.log('Zasiano dane demo');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
