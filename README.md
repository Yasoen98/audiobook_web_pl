# Audiobook Web PL

Prosta aplikacja webowa umożliwiająca użytkownikom odtwarzanie audiobooków z zapamiętywaniem postępu, a administratorom zarządzanie biblioteką nagrań.

## Wymagania wstępne

- System Linux z dostępem do powłoki Bash
- Połączenie z internetem (na potrzeby instalacji zależności)
- Zainstalowany `git`

> **Uwaga:** Instrukcja zakłada świeży system Ubuntu/Debian. Na innych dystrybucjach polecenia mogą się nieco różnić.

## Instalacja krok po kroku

1. **Zainstaluj Node.js (LTS) oraz npm**

   ```bash
   sudo apt update
   sudo apt install -y curl ca-certificates
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs build-essential
   ```

   Polecenie z Nodesource doda repozytorium z aktualną wersją Node.js 18 LTS. Możesz sprawdzić instalację:

   ```bash
   node -v
   npm -v
   ```

2. **Sklonuj repozytorium i przejdź do katalogu projektu**

   ```bash
   git clone <adres_repozytorium>
   cd audiobook_web_pl
   ```

3. **Zainstaluj zależności projektu**

   ```bash
   npm install
   ```

   Jeśli pojawi się problem z dostępem do rejestru npm, upewnij się że sieć nie blokuje połączenia `https://registry.npmjs.org`.

4. **Utwórz katalogi na przesyłane pliki (opcjonalne)**

   Serwer tworzy wymagane katalogi (`uploads/images`, `uploads/pdfs`, `uploads/audio`) automatycznie przy pierwszym uruchomieniu. Jeśli chcesz je przygotować ręcznie:

   ```bash
   mkdir -p uploads/images uploads/pdfs uploads/audio
   ```

## Uruchomienie aplikacji

1. **Wystartuj serwer**

   ```bash
   npm start
   ```

   Domyślnie aplikacja nasłuchuje na porcie `3000`. W terminalu powinien pojawić się komunikat `Serwer działa na porcie 3000`.

2. **Wejdź na stronę**

   Otwórz przeglądarkę i przejdź pod adres [http://localhost:3000](http://localhost:3000).

## Logowanie i role

- **Administrator**: `admin` / `admin123`
- **Użytkownik**: `user` / `user123`

Po zalogowaniu jako administrator uzyskasz dostęp do formularza przesyłania nowych pozycji (okładka, plik PDF oraz nagranie MP3). Zwykły użytkownik ma dostęp do biblioteki audiobooków i odtwarzacza zapamiętującego postęp słuchania.

## Struktura danych

- `data/library.json` — lista elementów biblioteki (tworzona automatycznie, jeśli brak)
- `data/progress.json` — zapis postępów odtwarzania poszczególnych użytkowników
- `uploads/` — katalog na przesłane przez administratora pliki

Pliki są zapisywane w formacie JSON. Możesz wykonywać kopie zapasowe tych plików, aby przenosić bibliotekę między środowiskami.

## Dodatkowe informacje

- Zmienna środowiskowa `PORT` pozwala zmienić port, na którym działa serwer (np. `PORT=4000 npm start`).
- W przypadku wdrożenia na produkcję zaleca się ustawienie własnej, bezpiecznej wartości `secret` w konfiguracji sesji (`src/server.js`).
- Serwer udostępnia statycznie katalog `public/`, który zawiera interfejs użytkownika aplikacji.

