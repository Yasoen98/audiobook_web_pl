'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { usePlayerStore } from '../../store/player-store';

export const PlayerCard = () => {
  const {
    isPlaying,
    toggle,
    currentSegment,
    speed,
    setSpeed,
    volume,
    setVolume,
    selectedVoice,
    setSelectedVoice
  } = usePlayerStore();

  useEffect(() => {
    setSelectedVoice('default');
  }, [setSelectedVoice]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Odtwarzacz</CardTitle>
        <p className="text-sm text-muted-foreground">
          Strumieniuj wygenerowane audio i śledź aktualne zdanie (karaoke).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Aktualny segment</p>
          <p className="text-lg font-semibold text-emerald-600">{currentSegment.text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
            onClick={toggle}
          >
            {isPlaying ? 'Pauza' : 'Odtwarzaj'}
          </button>
          <button type="button" className="rounded-full border border-border px-3 py-2 text-sm">
            Pobierz audio MP3
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Model głosu</span>
            <select
              value={selectedVoice}
              onChange={(event) => setSelectedVoice(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="default">Domyślny lektor demo</option>
              <option value="custom">Mój model 01</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Prędkość</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span className="text-xs text-muted-foreground">{speed.toFixed(1)}×</span>
          </label>
          <label className="space-y-1 text-sm">
            <span>Głośność</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
            <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
};
