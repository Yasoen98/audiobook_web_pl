export type Role = 'user' | 'admin';

export interface VoiceModelDTO {
  id: string;
  userId: string;
  name: string;
  lang: 'pl-PL';
  status: 'preparing' | 'training' | 'validating' | 'ready' | 'failed';
  samplesCount: number;
  sampleRate: number;
  architecture: string;
  watermarkEnabled: boolean;
  createdAt: string;
}

export interface PdfFileDTO {
  id: string;
  userId: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number;
  tags: string[];
  createdAt: string;
}

export interface PdfSegmentDTO {
  id: string;
  pdfId: string;
  page: number;
  order: number;
  text: string;
  startChar: number;
  endChar: number;
}

export interface TtsJobDTO {
  id: string;
  userId: string;
  pdfId: string;
  voiceModelId: string;
  type: 'stream' | 'batch';
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  resultKey: string | null;
  createdAt: string;
}
