import { VoiceModelsCard } from '../../components/dashboard/voice-models-card';
import { PdfLibraryCard } from '../../components/dashboard/pdf-library-card';
import { PlayerCard } from '../../components/dashboard/player-card';
import { ComplianceCard } from '../../components/dashboard/compliance-card';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-white">
      <header className="mx-auto mb-10 max-w-6xl text-center">
        <h1 className="text-4xl font-bold">Panel Polski Lektor AI</h1>
        <p className="mt-2 text-slate-300">
          Zarządzaj swoimi modelami głosu, biblioteką PDF i zadaniami syntezy mowy.
        </p>
      </header>
      <section className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
        <VoiceModelsCard />
        <PdfLibraryCard />
        <PlayerCard />
        <ComplianceCard />
      </section>
    </main>
  );
}
