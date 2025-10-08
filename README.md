# Polski Lektor AI

Monorepo z aplikacją webową do trenowania modeli głosu i odczytu dokumentów PDF. Projekt składa się z trzech aplikacji:

- **Frontend (Next.js 14)** – panel użytkownika, odtwarzacz i zarządzanie biblioteką.
- **Backend (Fastify + Prisma)** – API, kolejki BullMQ, integracja z magazynem plików i Postgres.
- **Mikroserwis TTS (FastAPI + PyTorch)** – przygotowanie datasetów, symulowany trening oraz inferencja audio.

## Wymagania

- Node.js 20
- pnpm 8
- Python 3.11
- Docker + docker-compose

## Szybki start (dev)

```bash
pnpm install
cp .env.example .env
pnpm --filter backend generate
pnpm --filter backend migrate:dev
pnpm --filter backend seed
pnpm dev
```

Aplikacje będą dostępne pod adresami:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Dokumentacja TTS: http://localhost:8000/docs

## Docker Compose

```bash
docker-compose up --build
```

Domyślne porty:

- Frontend – 3000
- Backend – 4000
- TTS – 8000
- Postgres – 5432
- Redis – 6379
- MinIO – 9000 / konsola 9001
- ClamAV – 3310

## Konta demo

- **demo@lektor.ai / Demo!1234** – użytkownik z przygotowanym modelem i PDF.

## Struktura katalogów

```
apps/
  frontend/   # Next.js + Tailwind + Zustand
  backend/    # Fastify + Prisma + BullMQ
  tts-svc/    # FastAPI + PyTorch (stub treningu)
packages/
  shared/     # Współdzielone schematy Zod i typy
```

## Testy i jakość kodu

```bash
pnpm --filter frontend test
pnpm --filter backend test
pnpm --filter backend lint
pnpm --filter frontend lint
pnpm --filter backend format
pnpm --filter frontend format
cd apps/tts-svc && pytest && ruff check . && mypy .
```

## Kolejki i zadania tła

Backend uruchamia kolejkę `tts-batch` w BullMQ. Zadania symulują generowanie audio, a wynikowe pliki są odkładane w pamięci (stub). W docelowej implementacji należy podpiąć MinIO/S3 i mikroserwis TTS.

## Mikroserwis TTS

- `POST /dataset/prepare` – zapisuje przesłane próbki i tworzy manifest JSONL.
- `POST /train` – symuluje trening i aktualizuje status.
- `GET /train/{id}/status` – zwraca status.
- `POST /tts/{modelId}` – generuje próbkę audio (fala sinusoidalna) z metadanymi watermarku.

Instrukcja integracji z rzeczywistym modelem Coqui-TTS znajduje się w komentarzach TODO w kodzie.

## Segmentacja PDF

Moduł `textProcessing.ts` zawiera uproszczone reguły segmentacji polskich zdań oraz normalizację liczb wykorzystywane w backendzie i przetestowane przy pomocy Vitest.

## Bezpieczeństwo

- Walidacja MIME/magic bytes.
- Limit rozmiaru uploadu (50 MB).
- Rate limiting i nagłówki CSP (helmet).
- Integracja z ClamAV przygotowana pod docker-compose (stub w kodzie do dalszego rozwinięcia).

## TODO produkcyjne

- Podłączenie prawdziwego storage (MinIO/S3) zamiast pamięci.
- Integracja z kolejką treningową mikroserwisu TTS.
- Implementacja realnego ASR i forced alignmentu (np. Montreal Forced Aligner).
- Rozszerzenie normalizacji tekstu (daty, waluty, liczby porządkowe).
- Dodanie autoryzacji administracyjnej w frontendzie (panel admina).
