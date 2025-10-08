'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useState } from 'react';

interface PdfFile {
  id: string;
  title: string;
  tags: string[];
  pageCount: number;
  createdAt: string;
}

const fetchPdfs = async (): Promise<PdfFile[]> => {
  const response = await axios.get('/api/mock/pdfs');
  return response.data;
};

export const PdfLibraryCard = () => {
  const { data = [] } = useQuery({ queryKey: ['pdfs'], queryFn: fetchPdfs });
  const [search, setSearch] = useState('');

  const filtered = data.filter((pdf) => pdf.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Biblioteka PDF</CardTitle>
        <p className="text-sm text-muted-foreground">
          Przeszukuj, taguj i organizuj dokumenty. Obsługujemy miniatury i pełnotekstowe wyszukiwanie.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Szukaj w tytułach i tagach"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((pdf) => (
            <div key={pdf.id} className="rounded-lg border border-border p-3 transition hover:border-emerald-400">
              <p className="font-semibold">{pdf.title}</p>
              <p className="text-xs text-muted-foreground">Stron: {pdf.pageCount}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {pdf.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Brak dokumentów spełniających kryteria.</p>}
        </div>
      </CardContent>
    </Card>
  );
};
