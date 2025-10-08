import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { fileStorage, createStorageKey } from '../../services/fileStorage.js';
import { validateMimeAndMagic, clamavScan } from '../../services/security.js';
import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import { segmentPdfText } from '../../services/textProcessing.js';

const pdfRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized();
    }
  });

  app.get('/', async (request) => {
    const userId = (request.user as any).sub;
    return prisma.pdfFile.findMany({ where: { userId } });
  });

  app.post('/', async (request, reply) => {
    const mp = await request.file();
    if (!mp) {
      return reply.badRequest('Brak pliku');
    }
    const { buffer, type } = await validateMimeAndMagic(mp, ['application/pdf']);
    await clamavScan(buffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const existing = await prisma.pdfFile.findUnique({ where: { hash } });
    if (existing) {
      return reply.conflict('Plik już istnieje');
    }
    const pdfData = await pdfParse(buffer);
    const key = createStorageKey('pdf', mp.filename);
    await fileStorage.upload({ key, buffer, contentType: type.mime });
    const userId = (request.user as any).sub;
    const pdf = await prisma.pdfFile.create({
      data: {
        userId,
        title: pdfData.info?.Title ?? mp.filename,
        originalName: mp.filename,
        storageKey: key,
        sizeBytes: buffer.length,
        pageCount: pdfData.numpages ?? 1,
        tags: [],
        hash
      }
    });
    const segments = segmentPdfText(pdfData.text || '');
    await prisma.pdfSegment.createMany({
      data: segments.map((segment, index) => ({
        pdfId: pdf.id,
        page: segment.page,
        order: index,
        text: segment.text,
        startChar: segment.startChar,
        endChar: segment.endChar
      }))
    });
    return pdf;
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pdf = await prisma.pdfFile.findUnique({ where: { id } });
    if (!pdf) {
      return reply.notFound('Nie znaleziono PDF');
    }
    return pdf;
  });

  app.get('/:id/segments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { from = '0', limit = '50' } = request.query as { from?: string; limit?: string };
    const segments = await prisma.pdfSegment.findMany({
      where: { pdfId: id },
      skip: Number(from),
      take: Number(limit),
      orderBy: { order: 'asc' }
    });
    return segments;
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.pdfFile.delete({ where: { id } });
    return reply.code(204).send();
  });
};

export default pdfRoutes;
