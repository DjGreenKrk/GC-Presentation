# Input Router — projekt sterowania urządzeniami HID

Status: **etap 2/3, pomocniczy adapter Windows w Draft, bez aktywnej emisji** (2026-11-22). [Issue #7](https://github.com/DjGreenKrk/GC-Presentation/issues/7) · [MASTER #3](https://github.com/DjGreenKrk/GC-Presentation/issues/3) · [Architektura](ARCHITECTURE.md)

## Cel

Rozróżniać fizyczne urządzenia sterujące (Baseus Red Dot na USB oraz prototyp GC CUE działający jako klawiatura HID) od zwykłej klawiatury operatora, przypisywać akcje konkretnego urządzenia, działać również gdy na pierwszym planie jest OBS/PowerPoint. Wszystko offline i z minimalnym wpływem na emisję.

To zadanie **nie** polega na zainstalowaniu globalnego hooka do klawiatury, który reaguje na wszystkie naciśnięcia.

## Potwierdzona technologia Windows

Raw Input: [Microsoft — Using Raw Input](https://learn.microsoft.com/en-us/windows/win32/inputdev/using-raw-input), [Raw Input overview](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-raw-input), [RAWINPUTDEVICE](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice).

Rekomendowany adapter natywny na Windows:
- Własne, ukryte okno Win32 z pętlą zdarzeń; `RegisterRawInputDevices` dla Keyboard HID (Usage Page 0x01, Usage 0x06) z `RIDEV_INPUTSINK` i `RIDEV_DEVNOTIFY`.
- Odbiór `WM_INPUT` → `GetRawInputData` → `RAWINPUTHEADER.hDevice`, `RAWKEYBOARD.MakeCode`, flagi break/extended. Nie opierać się na przełożonym na znak `event.key`, zależnym od układu.
- Enumeracja `GetRawInputDeviceList` i `GetRawInputDeviceInfo` (w tym `RIDI_DEVICENAME`) do wyboru urządzenia i diagnostyki.
- Odbiór `WM_INPUT_DEVICE_CHANGE` do sygnalizacji podłączenia/odłączenia i zwolnienia trzymanych klawiszy.
- Wątek natywny lub pomocniczy proces nie może zablokować renderera i emisji; oddzielić lifecycle od okien Program/Next/Presenter.

**Krytyczna pułapka:** Raw Input z `RIDEV_INPUTSINK` pozwala aplikacji odbierać zdarzenia w tle, ale **nie blokuje** zwykłego klawisza w aplikacji z fokusem. `RIDEV_NOLEGACY` dotyczy komunikatów legacy odbiorcy, nie jest uniwersalnym, selektywnym pochłaniaczem klawiszy w innych aplikacjach. Nie obiecywać, że Baseus PageDown nie przełączy slajdu w PowerPoincie, OBS czy innym aktywnym programie. Przed użyciem na sztuce należy przetestować, jakie klawisze rzeczywiście emituje odbiornik.

GC CUE może z czasem wystawiać **własny HID usage/report**, który ma mniejsze ryzyko kolizji z systemowymi klawiszami — wymaga świadomego wsparcia w jego firmware i osobnego adaptera.

## Podział modułów

```text
Win32 Raw Input helper + Node transport (Draft, bez UI)
     │ rozpoznane urządzenie / klawisz / key down/up
     ▼
Normalized InputDeviceEvent
     ▼
DeviceInputRouter (ten PR, czysta logika)
     │ profile urządzeń, bindingi, brak auto-repeat
     ▼
InputAction (next/previous/blackout/whiteout/first/last)
     ▼
Centralny kontroler prezentacji (przyszły, jedyny wykonawca)
     ▼
Program / Next / Presenter / NDI
```

**PR #16 implementuje czystą domenę `DeviceInputRouter` i testy.** Kolejny Draft (oparty na #16) dodaje natywny helper Win32 i warstwę transportową Node. Nie uruchamia ich automatycznie, nie ma jeszcze parowania ani połączenia z emisją.

## Model i bezpieczeństwo

- Domyślnie **zero przypisanych urządzeń**: nieznana klawiatura nie steruje emisją.
- Profile: `deviceId` (rozwiązany przez adapter na tożsamość urządzenia), `enabled`, lista mapowań `code -> action`.
- Akcje: `next-slide`, `previous-slide`, `first-slide`, `last-slide`, `blackout-toggle`, `whiteout-toggle`.
- Zdarzenie zawiera ID, normalizowany kod sprzętowy, `down`/`up` oraz `repeat`. Ponawiane `down` nie wyzwala kolejnego slajdu aż do `up`.
- Odłączenie urządzenia zeruje stan jego wciśniętych przycisków; ponowne podłączenie nie aktywuje nieznanego urządzenia automatycznie.
- Konflikt dwóch mapowań jednego kodu na jednym urządzeniu to błąd konfiguracji. Konfiguracja jest wymieniana atomowo dopiero po walidacji.

### Identyfikacja odbiornika

`hDevice` jest tymczasowym uchwytem sesji, **nie trwałym identyfikatorem**. Ścieżki urządzeń Raw Input mogą zależeć od portu i enumeracji. Nie wolno utożsamiać samego VID/PID z pojedynczym fizycznym odbiornikiem, jeśli podłączone mogą być dwie identyczne sztuki. Dopuszczalne warianty:
1. Jednoznaczny numer seryjny, jeśli sprzęt go wystawia.
2. Wskazanie konkretnej instancji odbiornika przez użytkownika i zapis mapowania z informacją o ewentualnej zmianie portu.
3. Jawna prośba o ponowne sparowanie, gdy identyfikacja jest niejednoznaczna; **bez automatycznego wiązania wszystkich klawiatur**.

## Etapy wdrożenia

1. **Core (ten PR):** modele, walidacja, brak domyślnej władzy urządzeń, wciśnięcia/zwolnienia, testy bez Electrona i NDI.
2. **Adapter Windows (Draft):** osobny proces `native/raw-input-helper/raw_input.cpp` z trybami `--list` i `--watch <exact-device-path>`, protokół NDJSON, `RawInputHelperClient`, kompilacja Windows i pakowanie poza ASAR. Brak uruchamiania przy starcie, brak automatycznego parowania. Wciąż konieczny test na Baseusie/GC CUE.
3. **Integracja operatorska:** lista rzeczywiście wykrytych urządzeń, tryb uczenia mapowania, profile lokalne, komendy poprzez centralny kontroler, rozdzielenie klawiatury operatorskiej od Raw Input (bez podwójnych akcji).

Odbiór etapu #7 dopiero po rzeczywistym teście Win32 + OBS w fokusie, a także zachowania zwykłych klawiszy w aktywnej aplikacji. Dopóki adapter nie jest przetestowany, system pozostaje wyłączony / niedostępny w interfejsie.

## Diagnostyka adaptera (Windows, etap 2)

W **x64 Developer Command Prompt** (z MSVC w PATH) uruchom `npm run build:raw-input`. Powstanie `native/raw-input-helper/bin/gc-raw-input.exe` (wynik ignorowany przez Git). Windows CI kompiluje helper i wykonuje bezpieczny test enumeracji; instalator dołącza exe pod `resources/hid/gc-raw-input.exe`, poza ASAR. Linux i macOS nie wymagają helpera.

- `gc-raw-input.exe --list` wypisuje po jednej linii JSON `{ "type": "device", "id": "...", "label": "..." }`. To tylko **wyliczanie odbiorników**, bez śledzenia naciśnięć.
- `gc-raw-input.exe --watch "<dokładne ID z listy>"` uruchamia nasłuch **dopiero po wybraniu konkretnego odbiornika**. Zwraca `ready`, `event` (sprzętowy kod `down/up`) i `disconnected` przy wyjęciu USB. Nie ma fallbacku na dowolną klawiaturę i nie ma automatycznego restartu.
- `src/shared/rawInputProtocol.ts` odrzuca błędne/nieznane linie JSON. `src/main/services/rawInputHelper.ts` ma ograniczenie czasu enumeracji, kończy obserwację po utracie procesu i przekazuje zdarzenia ze wskazaną tożsamością urządzenia. **Nie emituje komend slajdów.**

**Prywatność:** ID urządzenia może zawierać numer instancji USB. Nie publikować surowych wyników `--list` w issue ani publicznych logach bez kontroli danych.

**Ograniczenie Windows:** `RIDEV_INPUTSINK` zapewnia nasłuch przy nieaktywnym oknie GC-Presentation, ale nie przechwytuje ani nie wyłącza klawiszy wysyłanych do programu pierwszoplanowego. Test z OBS i PowerPoint pozostaje wymagany przed użyciem na sztuce.

## Etap 3a — panel diagnostyczny (Draft)

W konsoli na Windows pojawia się przycisk **HID — test**. To **nie jest jeszcze panel z aktywnym sterowaniem emisją**:

1. Otwórz panel, kliknij **Odśwież**, wybierz konkretny odbiornik z listy. Lista nie rozpoczyna monitorowania klawiszy.
2. Kliknij **Testuj przyciski**, naciśnij kilka przycisków wybranego pilota i sprawdź wykryte kody `kbd:scan:...` (lub awaryjne `kbd:vkey:...`).
3. Możesz wybrać akcję przy każdym kodzie, ale są to **tymczasowe mapowania pokazowe**, niezapisywane i niewykonywane.
4. **Zatrzymaj** kończy sesję odbiornika; zamknięcie panelu również najpierw zatrzymuje nasłuch, a dopiero potem przywraca zwykłe skróty prezentacji.

W stanie otwartego panelu lokalne `keydown` w GC-Presentation (PageDown, strzałki, `b`, `w`) **nie wykonują akcji prezentacji**. To ważne, bo Windows i tak wysyła klawisze emitowane przez pilot-klawiaturę do aktywnej aplikacji. Nie chroni to **innych programów** (OBS/PowerPoint) będących na wierzchu — sprawdzić bez emisji na żywo.

Bezpieczeństwo granicy Electron:
- Tylko konsola główna (`mainWindow.webContents.mainFrame`) może wywołać IPC `hid:list/status:watch/stop`; okna wyjściowe Program/Next/Presenter nie uzyskują uprawnień.
- Start ponownie sprawdza, czy dokładny identyfikator odbiornika jest obecny na aktualnej liście; nie wystarczy sam VID/PID. Nasłuch nie startuje automatycznie.
- Po odłączeniu, zamknięciu konsoli lub zatrzymaniu obserwacji nie następuje automatyczne przełączenie na inną klawiaturę.
- Pełne identyfikatory sprzętowe nie są emitowane w zdarzeniach klawiszy, ani do raportów telemetrycznych.

**Pozostaje do zrobienia:** potwierdzona kompilacja Windows i test fizyczny Baseusa/GC CUE, trwały zapis nieaktywnych profili i ich zatwierdzanie, bezpieczne przekazanie zatwierdzonych akcji do centralnego Presentation Controller, test pracy w tle z OBS. Do tego czasu Issue #7 pozostaje otwarte.
