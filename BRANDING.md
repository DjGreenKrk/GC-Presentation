# GC-Presentation — branding produktu

Kanon GreenCrew Tools (nie kopiować do tego repo):

- [Branding ogólny](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/GREENCREW_BRANDING.md)
- [Design System](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/DESIGN_SYSTEM.md)
- [Ikonografia](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/ICONOGRAPHY.md)
- [Zasady pisania](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/WRITING_GUIDELINES.md)
- [**Specyfikacja produktu: GC-Presentation**](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/project/BRANDING_GCPRESENTATION.md) (proponowana w osobnym PR)

## Świadomy wyjątek platformowy

Konsola operatorska to aplikacja **desktop-first**, ze względu na pracę z fizycznymi monitorami, NDI i kontrolerami. Widoki Presenter/WWW mają być responsywne na telefonie i tablecie. Pozostałe zasady wspólne obowiązują bez wyjątków.

## Obecne decyzje

- Nazwa robocza: **GC-Presentation**.
- Główny akcent UI: **`#00C853`**, zgodnie z aktualną dokumentacją; na razie nie zmieniamy na `#1DCE1D`.
- Ciemny, stonowany panel operatorski. Bez dekoracyjnych animacji.
- Nowa ikona jeszcze **niezatwierdzona**. Nie zastępować obecnych plików produkcyjnych przed akceptacją symbolu i eksportów.

## Lokalne zasoby

Obecne `build/icon.*` i `resources/icon.png` pochodzą z forka Presentation Commander. Docelowa identyfikacja GC-Presentation i komplet zasobów brandingu to osobny etap. SVG źródłowy ma pozostać w katalogu `app_logo/` wspólnego repozytorium, a kopie wymagane do buildu — lokalnie i wersjonowane.

## Prawa

Repozytorium jest forkiem [Presentation Commander Client](https://github.com/stoatworks-labs/presentation-commander-client) na licencji MIT. **Zachowujemy LICENSE, atrybucje i inne wymagane informacje o prawach oryginalnych autorów.** Prawa do logo i materiałów GreenCrew reguluje osobne [RIGHTS.md](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/RIGHTS.md).

Niniejszy plik nie zmienia licencji odziedziczonego kodu.
