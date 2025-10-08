'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export const ComplianceCard = () => {
  const [consents, setConsents] = useState({
    ownership: true,
    terms: true,
    antiImpersonation: true
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Zgodność i prywatność</CardTitle>
        <p className="text-sm text-muted-foreground">
          Dbamy o etyczne wykorzystanie technologii. Wszystkie nagrania są przetwarzane zgodnie z RODO.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
          <p className="font-semibold text-emerald-700">Skrót polityki prywatności</p>
          <p>
            Nagrania służą wyłącznie do treningu Twojego modelu głosu. Każda synteza jest znakowana watermarkiem i
            metadanymi z identyfikatorem modelu.
          </p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consents.ownership}
            onChange={(event) => setConsents((prev) => ({ ...prev, ownership: event.target.checked }))}
          />
          To mój głos i mam do niego prawa.
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consents.terms}
            onChange={(event) => setConsents((prev) => ({ ...prev, terms: event.target.checked }))}
          />
          Akceptuję regulamin i politykę prywatności.
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consents.antiImpersonation}
            onChange={(event) =>
              setConsents((prev) => ({ ...prev, antiImpersonation: event.target.checked }))
            }
          />
          Nie będę wykorzystywać nagrań do podszywania się.
        </label>
      </CardContent>
    </Card>
  );
};
