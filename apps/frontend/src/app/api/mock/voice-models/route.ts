import { NextResponse } from 'next/server';

export const GET = async () => {
  return NextResponse.json([
    {
      id: 'demo-voice',
      name: 'Domyślny lektor demo',
      status: 'ready',
      architecture: 'vits',
      createdAt: new Date().toISOString()
    }
  ]);
};
