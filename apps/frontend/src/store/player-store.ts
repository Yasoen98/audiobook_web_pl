'use client';

import { create } from 'zustand';

interface PlayerState {
  isPlaying: boolean;
  currentSegment: { id: string; text: string };
  speed: number;
  volume: number;
  selectedVoice: string;
  toggle: () => void;
  setSegment: (segment: { id: string; text: string }) => void;
  setSpeed: (value: number) => void;
  setVolume: (value: number) => void;
  setSelectedVoice: (value: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  currentSegment: { id: 'demo', text: 'To jest przykładowe zdanie z dokumentu demo.' },
  speed: 1,
  volume: 0.8,
  selectedVoice: 'default',
  toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setSegment: (segment) => set({ currentSegment: segment }),
  setSpeed: (value) => set({ speed: value }),
  setVolume: (value) => set({ volume: value }),
  setSelectedVoice: (value) => set({ selectedVoice: value })
}));
