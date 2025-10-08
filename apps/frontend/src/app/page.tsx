import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-slate-800 text-white">
      <div className="max-w-xl rounded-2xl bg-black/40 p-8 shadow-xl backdrop-blur">
        <h1 className="mb-4 text-4xl font-bold">Polski Lektor AI</h1>
        <p className="mb-6 text-lg text-slate-200">
          Twój cyfrowy asystent do tworzenia modeli głosu i słuchania dokumentów PDF.
        </p>
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block rounded-lg bg-emerald-500 px-4 py-3 text-center font-semibold text-white shadow hover:bg-emerald-600"
          >
            Przejdź do panelu demo
          </Link>
          <p className="text-sm text-slate-300">
            Konto demo: <strong>demo@lektor.ai</strong> / <strong>Demo!1234</strong>
          </p>
        </div>
      </div>
    </main>
  );
}
