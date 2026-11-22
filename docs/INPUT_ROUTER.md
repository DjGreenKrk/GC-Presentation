# Input Router — projekt sterowania urządzeniami HID

Status: **etap 1/3, szkic wykonawczy** (2026-11-22). [Issue #7](https://github.com/DjGreenKrk/GC-Presentation/issues/7) · [MASTER #3](https://github.com/DjGreenKrk/GC-Presentation/issues/3) · [Architektura](ARCHITECTURE.md)

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
Win32 Raw Input worker (PR przyszły)
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

**Ten PR implementuje tylko czystą, testowalną domenę `DeviceInputRouter` i testy.** Nie odbiera jeszcze fizycznych zdarzeń Raw Input; nie daje operatorowi fałszywego przycisku „HID aktywny”.

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
2. **Adapter Windows:** osobny proces/N-API z Raw Input, enumeracją, sygnalizacją hotplug i autodiagnostyką; test interfejsu na prawdziwym Baseus/GC CUE.
3. **Integracja operatorska:** lista rzeczywiście wykrytych urządzeń, tryb uczenia mapowania, profile lokalne, komendy poprzez centralny kontroler, rozdzielenie klawiatury operatorskiej od Raw Input (bez podwójnych akcji).

Odbiór etapu #7 dopiero po rzeczywistym teście Win32 + OBS w fokusie, a także zachowania zwykłych klawiszy w aktywnej aplikacji. Dopóki adapter nie jest przetestowany, system pozostaje wyłączony / niedostępny w interfejsie.
