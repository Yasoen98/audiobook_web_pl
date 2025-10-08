'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface VoiceModel {
  id: string;
  name: string;
  status: string;
  architecture: string;
  createdAt: string;
}

const fetchVoiceModels = async (): Promise<VoiceModel[]> => {
  const response = await axios.get('/api/mock/voice-models');
  return response.data;
};

export const VoiceModelsCard = () => {
  const { data = [] } = useQuery({ queryKey: ['voice-models'], queryFn: fetchVoiceModels });
  const [creating, setCreating] = useState(false);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Mój głos</CardTitle>
        <p className="text-sm text-muted-foreground">Zarządzaj treningiem i wersjami swoich modeli.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
        >
          Utwórz nowy model głosu
        </button>
        {creating && (
          <div className="rounded-lg border border-dashed border-emerald-300 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-emerald-700">Wskazówki dotyczące próbek:</p>
            <ul className="list-disc pl-4">
              <li>Minimum 5 nagrań WAV (16 kHz, mono).</li>
              <li>Czas trwania 10–60 sekund, czyste tło.</li>
              <li>Zadbaj o poprawną dykcję i naturalne tempo.</li>
            </ul>
          </div>
        )}
        <div className="space-y-3">
          {data.map((model) => (
            <div key={model.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{model.name}</p>
                  <p className="text-xs text-muted-foreground">Architektura: {model.architecture}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {model.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Utworzony: {new Date(model.createdAt).toLocaleString('pl-PL')}
              </p>
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-muted-foreground">Brak modeli. Dodaj pierwszy model już teraz!</p>}
        </div>
      </CardContent>
    </Card>
  );
};
