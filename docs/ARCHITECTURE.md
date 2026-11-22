# GC-Presentation — projekt architektury

**Status:** propozycja, nie ukończona implementacja. Kanon: [GreenCrew Tools Architecture](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/development/ARCHITECTURE.md). Produkt: [ROADMAP](ROADMAP.md).

## Stan początkowy

Fork `stoatworks-labs/presentation-commander-client` korzysta z Electron + React + TypeScript, pdf.js, natywnego SDK NDI, Windows PowerPoint COM, AppleScript, OSC i WebSocket. Wiele odpowiedzialności (stan, import, sterowanie, wywoływanie NDI) znajduje się w `src/renderer/src/App.tsx`. Fizyczne Program Out jest osobnym `BrowserWindow`. Dwa sendery NDI już istnieją.

**Zasada migracji:** nie przepisywać silnika PDF, NDI, ani całego Electrona. Wydzielać moduły małymi, testowalnymi etapami. Nie zakładać na start zmiany na Tauri ani jednolitego serwera.

## Docelowy podział odpowiedzialności

```text
Inputs                         Presentation Controller (local)
  - UI keyboard                - source/session state (single authority)
  - physical HID               - commands / page navigation
  - OSC / Companion            - output view state / snapshots
  - HTTP/WS (optional)         - staged import / recovery
             |                              |
             +------------------------------+
                                            |
   Source adapters: PDF / PPTX Static / PowerPoint Live
                                            |
                               View composition
                 Program / Next / Presenter / Custom View
                                            |
                Output Router (routing per logical view)
             Electron display / native NDI / HTTP+WS
```

### Source layer

Zachować pomysł `SlideSource`, ale oddzielić strategię generowania klatek od wyświetlaczy. Wspólny kontrakt ma rozróżniać:

- **Static random access:** PDF lub przekonwertowany PPTX, można uzyskać stronę N i N+1 bez interakcji z zewnętrznym programem.
- **External/live state:** aplikacja zewnętrzna kontroluje krok animacji, media i aktualny stan; nie należy obiecywać dostępu do przyszłego frame'u.
- **Unsupported feature:** jawny stan `unsupported`, nigdy cichy sukces.

PowerPoint Live powinien być oddzielnym, opcjonalnym adapterem. Eksport PNG z obecnego PowerPoint bridge *nie* zachowuje animacji. Google Slides/Canva w obecnym połączeniu nie dają przyszłej klatki.

### Controller i stan

Stan lokalnej emisji jest nadrzędny wobec stanu UI, widoku WWW i integracji. Komendy `next`, `previous`, `goto`, `blackout` przechodzą przez jeden kontroler. Odbiorcy dostają snapshot, a potem aktualizacje wersjonowane lub z numerami sekwencji.

Nie blokować zmiany slajdu na NDI, sieci, importującym procesie ani zewnętrznym PowerPoincie. W przypadku błędu widoku lub eksportu zatrzymać ostatnią poprawną klatkę Program, a komunikat pokazać operatorowi.

### Import

Wydzielić sesję przygotowującą nową prezentację poza aktywną emisją:

```text
select -> validate -> load/convert -> read notes -> render/cache check
                                                    |
                                                ready | error
                                                    |
                               operator activates when ready
```

Stany: `idle`, `preparing`, `ready`, `failed`, `cancelled`. Timeout, anulowanie, log techniczny i informacja dla operatora. Nie czyścić aktywnej prezentacji do czasu gotowości zasobów. Dane niespójne (ukryte slajdy i numeracja notatek) muszą być wykrywane i sygnalizowane.

### View Engine

Widok jest logiczny, a nie tożsamy z jednym ekranem. Program to wyłącznie emisja; Next to strona/krok następny, a przy braku danych pokazuje jawne „brak” zgodnie z polityką wyjścia; Presenter składa aktualny/następny slajd i notatki. Custom HTML dopiero po stworzeniu stabilnego modelu stanu i mechanizmu izolacji.

### Output Router

Każde logiczne wyjście mapować na fizyczny ekran lub sender NDI / klienta webowego. Walidacja konfliktu przypisań, reagowanie na hotplug, przywracanie konfiguracji po restarcie. NDI nie może wymagać otwarcia okna operatora ani podpiętego HDMI; renderer wyjścia nie może wpływać na stan silnika prezentacji.

### Input Router

Na Windows identyfikacja fizycznego HID (Raw Input / platform-specific backend), mapowanie urządzenie + zdarzenie → akcja. **Przechwytywanie w tle nie jest tym samym co wyłączne zablokowanie zwykłych klawiszy w innym programie.** Baseus działający jako klawiatura wymaga testów; dla GC CUE (prototyp USB HID) rozważyć dedykowany usage/report, jeśli możliwe. Własne identyfikatory sprzętu i reguły parowania zapisywać lokalnie; sprawdzać zachowanie po przepięciu USB.

### Integracje i bezpieczeństwo

Natywna emisja offline jest trybem bazowym. OSC i WS mają rozdzielać odczyt od sterowania. Serwer WWW domyślnie lokalnie/na żądanie; dostęp z sieci LAN dopiero z autoryzacją i jawną konfiguracją. Custom HTML nie może mieć nieograniczonego dostępu do lokalnych plików, API Electrona lub dowolnego IPC. Reconnect musi odtworzyć snapshot. Błędy integracji nie zatrzymują Program.

## Własność konfiguracji i danych

- Ustawienia urządzeń/wyjść i wybrane widoki przechowywać lokalnie z wersjonowaniem schematu.
- Nie mieszać ustawień z zawartością prezentacji. Notatki i sidecary zachowywać przy imporcie.
- Migracje schematu zamiast resetowania.
- Logi diagnostyczne bez treści slajdów, tokenów i prywatnych danych.

## Niefunkcjonalne wymagania odbiorowe

- Działanie w stresie, w ciemności i bez Internetu.
- Brak nagłych czarnych klatek w Program w przypadku błędów innych wyjść.
- Czytelny stan „aktywne / brak / błąd / brak przyszłego slajdu”.
- Przewidywalny limit pamięci i CPU; unikać niepotrzebnej wielokrotnej rasteryzacji dokumentów.
- Testy na faktycznych monitorach HDMI/DP, NDI i obu pilotach HID na Windows.

## Zakres pierwszych PR-ów

1. Inżynierski baseline: #4 — bez refaktora silników.
2. Routing wyjść: #5; istniejący Draft PR #1 jest tylko etapem eksperymentalnym.
3. Niezawodny PPTX Static: #6, diagnoza #2.
4. HID i Presenter: #7 i #8.

Każde odejście od tej propozycji wymaga odnotowania, dlaczego uprości lub poprawi działanie w realnych warunkach eventowych.
