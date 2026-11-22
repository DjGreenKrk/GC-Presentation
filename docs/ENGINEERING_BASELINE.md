# Engineering baseline — GC-Presentation

[ROADMAP](ROADMAP.md) · [MASTER #3](https://github.com/DjGreenKrk/GC-Presentation/issues/3) · [Stage #4](https://github.com/DjGreenKrk/GC-Presentation/issues/4)

## Stan po przygotowaniu bazowej walidacji

Projekt odziedziczył kod Electron/React/TypeScript z natywnym nadajnikiem NDI. Do sprawdzenia każdego PR są potrzebne **dwie różne klasy testów**:

1. Statyczna walidacja (typy, testy czystej logiki, bundler) bez pobierania zamkniętego SDK NDI.
2. Pełny build instalatora, uruchomienie Electron, prawdziwy PDF/PPTX oraz próby na monitorach, NDI i HID.

Nie należy traktować zaliczenia pierwszej klasy jako potwierdzenia poprawnej emisji w drugiej.

## Przewidziane workflow

| Workflow | Trigger | Co weryfikuje |
| --- | --- | --- |
| `ci.yml` | PR, push main, ręcznie | `npm ci --ignore-scripts`, `npm test`, `typecheck`, `build` na **Windows** i **Linux** |
| `build-windows.yml` | **ręcznie** | pobranie NDI SDK, przebudowa addonów, instalator Windows, artifact do pobrania — **bez publikacji release** |
| `release.yml` | tag `v*` i ręcznie | macOS/Windows/Linux z NDI SDK; release na tagu `v*` |

**Uwaga:** workflow `release.yml` w wariancie manualnym również nie publikuje GitHub Release (publikacja ma warunek tagu). Instalatora nie wolno uznać za produkcyjny bez prób ręcznych.

### Dlaczego CI pomija postinstall

`native/ndi-send` wymaga zewnętrznego SDK NDI i kompilacji dla ABI Electrona. `npm ci --ignore-scripts` uniemożliwia natywne `node-gyp` w bazowym CI, ale pozwala sprawdzić TypeScript i renderer. Pełny test natywny jest w osobnym workflow Windows i w release. Nie zmieniać na `--legacy-peer-deps` bez odrębnego audytu.

### Testy czystej logiki

`npm test` uruchamia `node --experimental-strip-types --test tests/*.test.mjs` na Node.js 22. Testy nie importują Electrona ani NDI, obejmują m.in. wartości graniczne czasu przejść, rozpoznawanie efektów i kierunki animacji.

Testy dodane do repo **nie oznaczają, że wykonał się GitHub Actions**. Najpierw należy upewnić się, że Actions są włączone dla forka i odczytać wynik konkretnego workflow run.

## Testy na fizycznym stanowisku Windows

Do odbioru kolejnych etapów potrzebujemy:
- Dwa/trzy fizyczne ekrany (Program, Next, Presenter); hotplug i zachowanie po utracie Preview.
- Odtwarzanie PDF z szybko wciskanym Next/Previous.
- Próba statycznego PPTX oraz analiza błędu [#2](https://github.com/DjGreenKrk/GC-Presentation/issues/2); istniejący PowerPoint bridge to **PNG export**, nie natywny player animacji.
- Obsługa sterowania Baseus / GC CUE HID, także gdy OBS jest aktywnym oknem.
- Stabilność NDI z włączonym/wyłączonym streamem oraz test pod obciążeniem.

## Diagnostyka

Istnieje panel `src/renderer/src/components/DiagnosticsPanel.tsx` z przyciskami **Collect Diagnostics** i **Open Log Folder**. Jego IPC znajdują się w `src/main/index.ts`; szczegóły logowania w [diagnostics.md](diagnostics.md). Na Windows logi znajdują się domyślnie w `%LOCALAPPDATA%\\presentation-commander-client\\logs\\` — nazwa katalogu jest jeszcze odziedziczona po upstream.

Późniejszy rebranding nazw katalogów diagnostycznych i formatu raportów wymaga świadomej decyzji o migracji; nie zmieniać ich bez potrzeby.

## Znane ograniczenia baseline

- **Brak potwierdzonych runów Actions** w chwili utworzenia tej dokumentacji. Nie deklarować zielonego CI ani sukcesu instalatora przed uzyskaniem wyniku.
- Upstream `npm run lint` ma istniejące ostrzeżenia/błędy; obecne CI nie traktuje lint jako bramki. Należy je naprawić osobnym, kontrolowanym zadaniem.
- Build Linux/macOS i Windows zależy od dostępności źródeł oficjalnego SDK NDI. Licencji SDK nie zastępuje licencja MIT repozytorium.
- Osobny fizyczny Next Output pozostaje w [Draft PR #1](https://github.com/DjGreenKrk/GC-Presentation/pull/1), bez weryfikacji sprzętowej i bez merge.

## Warunek odbioru etapu #4

- Workflow CI przynajmniej raz kończy się poprawnie na Windows i Linux.
- `build-windows.yml` udostępnia artefakt instalatora z przebudowanym NDI addonem.
- Wyniki manualnego smoke testu oraz wyniki na prawdziwym ekranie/NDI są zapisane.
- Każda niewykonana kontrola jest jawnie wymieniona, a nie domyślnie uznana za PASS.
