import { NextResponse } from 'next/server';

export const GET = async () => {
  return NextResponse.json([
    {
      id: 'demo-pdf',
      title: 'Strategia rozwoju audio',
      tags: ['strategia', 'audio'],
      pageCount: 12,
      createdAt: new Date().toISOString()
    }
  ]);
};
