# GC-Presentation — plan rozwoju

**Status:** plan do przeglądu, 2026-11-22. Nie jest deklaracją ukończonych funkcji.
[MASTER #3](https://github.com/DjGreenKrk/GC-Presentation/issues/3) · [Architektura](ARCHITECTURE.md) · [Branding](../BRANDING.md)

## Cel

Niezawodny odtwarzacz prezentacji do pracy podczas wydarzeń: PDF i PPTX, rozdzielone Program/Next/Presenter, przypisania do fizycznych monitorów, NDI i w późniejszych etapach WWW, sterowanie po klawiaturze/HID, OSC, oraz offline first. Nie jest edytorem PowerPoint ani nowym GreenCrew Event Hub.

## Priorytety

| Faza | Issue | Zakres | Warunek zamknięcia |
| --- | --- | --- | --- |
| 0 / P0 | [#4](https://github.com/DjGreenKrk/GC-Presentation/issues/4) | Baseline: CI, build, testy, diagnostyka, atrybucje | Powtarzalny build i checki; brak regresji PDF/NDI |
| 1 / P0 | [#5](https://github.com/DjGreenKrk/GC-Presentation/issues/5) | Routing Program/Next/Presenter na ekrany | Program/Next/Presenter niezależnie, także bez NDI |
| 2 / P0 | [#6](https://github.com/DjGreenKrk/GC-Presentation/issues/6) | Import PPTX Static (PDF + notatki) | PowerPoint nie jest wymagany; porażka nie wyłącza Program |
| 3 / P0 | [#7](https://github.com/DjGreenKrk/GC-Presentation/issues/7) | Input Router: Baseus + GC CUE HID | Reaguje w tle, per-device, bez niepożądanych duplikatów |
| 4 / P0 | [#8](https://github.com/DjGreenKrk/GC-Presentation/issues/8) | Presenter Out lokalny | Aktualny + następny slajd + notatki |
| 5 / P1 | [#9](https://github.com/DjGreenKrk/GC-Presentation/issues/9) | Lokalny HTTP/WebSocket | Odczyt/sterowanie z telefonu na LAN, z autoryzacją |
| 6 / P1 | [#10](https://github.com/DjGreenKrk/GC-Presentation/issues/10) | Custom HTML / Web Components | Własny układ działa offline i jest izolowany |
| 7 / P2 | [#11](https://github.com/DjGreenKrk/GC-Presentation/issues/11) | Opcjonalny PowerPoint Live | Animacje odtwarzane w natywnym silniku i przetestowane |
| 8 / P2 | [#12](https://github.com/DjGreenKrk/GC-Presentation/issues/12) | Companion/OSC i integracje | Brak wpływu ich awarii na lokalny pokaz |

**Istniejące:** [PR #1](https://github.com/DjGreenKrk/GC-Presentation/pull/1) jest Draftem pierwszego wycinka fazy #5 (fizyczny Next); **nie jest jeszcze zweryfikowany**. [Bug #2](https://github.com/DjGreenKrk/GC-Presentation/issues/2) — import Windows PPTX — należy rozwiązać w fazie #6. Bez duplikowania zgłoszeń.

Fazy P1/P2 można rozpocząć tylko, gdy nie destabilizują zakresu Event MVP. Kolejność wewnętrznych PR-ów jest elastyczna, ale każdy PR ma jedno zadanie i kryteria testów.

## Wersja docelowa Event MVP (0.1 — numer roboczy)

- Otwiera wielostronicowy PDF oraz statyczny PPTX bez zainstalowanego PowerPointa.
- Import pokazuje stan i błędy; aktualna emisja pozostaje na ekranie po awarii importu.
- Program, Next i Presenter są niezależnymi widokami na fizycznych ekranach; możliwość równoległego NDI.
- Presenter pokazuje aktualny/następny slajd i notatki, bez wpływu na Program.
- Wybrany pilot Baseus oraz GC CUE HID sterują w tle na Windows (z **jawnie sprawdzonymi** ograniczeniami filtrowania zwykłej klawiatury).
- Lokalna praca nie wymaga Internetu, Huba ani serwera prezentacji.
- Build i testy oraz próby na fizycznym wielomonitorowym stanowisku Windows są udokumentowane.

## Krytyczne scenariusze testowe

1. **Dwa/trzy wyjścia:** 2–3 monitory, przejście N → N+1, Preview nie zacina Program.
2. **Brak wyjścia:** odłączenie Next/Presenter nie kończy Program; podłączenie ponownie jest bezpieczne.
3. **Uszkodzony PPTX:** obecny Program pozostaje nienaruszony, operator dostaje przydatny komunikat.
4. **Pilot:** aplikacja w tle, OBS na pierwszym planie; test Baseus i GC CUE; sprawdzenie, czy Windows dostarcza dodatkowe zwykłe klawisze do OBS.
5. **Awaria sieci:** lokalny pokaz działa dalej bez LAN, NDI odbudowuje się oddzielnie.
6. **Szybki operator:** wielokrotne Next/Previous, skok do ostatniego slajdu, brak starego Preview.
7. **Wydajność:** test na docelowym laptopie pod obciążeniem OBS/NDI, pomiar opóźnienia zmiany slajdu i pamięci.

## Organizacja pracy

- Zasady wspólne: [GreenCrew_Tools_Docs](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs), bez kopiowania standardów.
- Multi-stage plan: MASTER #3 + issue etapowe; PR wiąże się z issue etapowym, nie zamyka MASTER.
- Nowe funkcje na osobnych gałęziach, najlepiej Draft PR. Nie robić merge do `main` bez pozytywnych testów.
- Zmiany architektury dokumentować w `docs/ARCHITECTURE.md` lub oddzielnym ADR; kompatybilność najpierw.
- Żadne nowe wymaganie nie uzasadnia automatycznego przepisywania PDF, NDI, GVideo ani Event Hub.
