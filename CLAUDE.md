# LifeVault

Persönliche PWA für Schule und Alltag: Unterlagen (mit Fotos/Dateien), Notizen, Aufgaben, Noten, Kalender. Läuft über GitHub Pages direkt aus diesem Repo (Branch `main`), installierbar auf Handy (Samsung/Android) und Laptop.

## Grundregeln

- **Alles bleibt in `index.html`.** Kein Framework, keine Abhängigkeiten, kein Build-Schritt. CSS steht im `<style>`-Block, das gesamte JavaScript in dem einen `<script>`-Block. Keine neuen Dateien für App-Code anlegen.
- **Oberfläche auf Deutsch**, Ansprache mit „du“. Texte kurz und alltagstauglich.
- **Mobil zuerst:** Jede Änderung muss auf 360–390 px Breite gut aussehen (kein horizontales Scrollen). Desktop ab 900 px hat eine Seitenleiste.
- **Datenformat nie ändern, ohne alte Daten automatisch umzuwandeln.** Bestehende Einträge auf Handy, Laptop und im Daten-Repo müssen nach jedem Update weiter funktionieren. Neue Felder immer optional behandeln (`x.feld || ''`).
- **Dieses Repo ist öffentlich.** Niemals Tokens, Passwörter oder echte Daten committen. Ein Hook blockiert Text, der wie ein GitHub-Token aussieht (siehe unten).

## Gestaltung („Werkstatt“)

- Farben nur über die CSS-Variablen im `:root`-Block (hell und dunkel). Jede Farbe hat eine feste Rolle:
  - `--brand` **Rot** (Bennys Lieblingsfarbe, Hausfarbe): Hauptbuttons (`.btn.primary`), Plus-Taster (`.fab`), aktiver Menüpunkt, Kante am Tageskopf, Abschnitt „Fällig“. Nicht großflächig einsetzen.
  - `--danger` (gleiches Rot): überfällig, Sonn- und Feiertage (wie im Wandkalender).
  - `--signal` **Gelb**: nur „heute/jetzt“.
  - `--accent` **Blau**: Links, Fokus, Aufgaben, Bereich Schule. `--accent2` **Türkis**: Termine, Bereich Alltag. `--orange`: Arbeiten/LKs. `--ok` **Grün**: Noten.
  - `--text` Tusche für Text und Umschalter, `--bg` Zeichengrau als Grund.
- Abschnittsköpfe nach Inhaltstyp einfärben: `class="sec-h kc" style="--k:var(--orange)"` (Linie + Farbquadrat); Übersichtskacheln mit `k-exam`, `k-todo`, `k-event`.
- Schrift: `--font-d` (DIN: Bahnschrift, Roboto Condensed …) für Titel, Zahlen, Schilder und Buttons; Fließtext bleibt Systemschrift. Keine Großbuchstaben-Labels.
- Kleine Radien (`--radius` 6 px, `--radius-s` 3 px), Linien statt weicher Schatten. Abschnittsköpfe (`.sec-h`) mit dicker Linie darunter.
- Lernfeld-/Kategorie-Farbe als „Ader“: `.todo.wired` mit `--c`, Feld-Schilder `.tag.fld` mit `--c` (Farbquadrat statt farbiger Fläche).
- Hintergrund (`body::before`/`::after`, fest stehend): Lichtverlauf `--bg-top` → `--bg-bottom`, roter Schimmer oben rechts (`--glow`), blauer unten links (`--glow2`), feines Zeichenraster (`--grid`, `--grid-major`), das nach unten ausblendet. Benny nutzt den Dunkelmodus; dort zuerst prüfen. Dezent halten, Karten müssen klar davor stehen.
- Freie Tage (Feiertage) schraffiert über `--hatch`. Turnus-Arten als Farbband (Startseite) bzw. Tönung (Monatskalender).
- Umschalter (`.seg`, `.tabs`, `.chip.btnlike`) wie Wahlschalter: aktive Stellung in Tusche gefüllt.
- App-Symbol „Tresor“ (Tresortür mit rotem Zahlenrad, Lichtspalt, Unterlagen dahinter). Quellen: `icon.svg` (Kachel mit Neonkante → `icon-192.png`, `icon-512.png`, auch Logo in der Seitenleiste) und `icon-maskable.svg` (randlos für Android → `icon-maskable-512.png`). PNGs bei Änderungen aus den SVGs neu rendern (1024 px, dann verkleinern).

## Aufbau von `index.html`

Das Skript ist in Abschnitte gegliedert, jeweils mit einem `/* ===== … ===== */`-Kommentar:

1. **Kernlogik** – Datenmodell, IndexedDB, Hilfsfunktionen, Feiertage, Turnus, Noten, Benachrichtigungen
2. **Sync** – Abgleich mit dem privaten Daten-Repo über die GitHub-API
3. **Oberfläche Teil 1** – Dialoge, Router, Start (Dashboard), Inhalte, Schuljahr, Lernfeld, Unterlage
4. **Oberfläche Teil 2** – Aufgaben, Notizen, Suche, Optionen (`vSettings`), Foto-Viewer, OCR, Aktionen (`ACT`), `init()`
5. **Oberfläche Teil 3** – Kalender (Monat + Turnus), Arbeiten/LKs, Termine

Wichtige Muster:

- **Router:** Hash-basiert (`#/`, `#/inhalte`, `#/f/<id>` …). `render()` ruft eine `v…()`-Funktion auf, die `{ title, back, actions, body }` zurückgibt.
- **Klicks:** Ein globaler Listener verteilt Klicks auf Elemente mit `data-a="…"` an das Objekt `ACT`. Buttons, die nur innerhalb eines Dialogs wirken, bekommen bewusst **kein** `data-a` (sondern z. B. `data-del`, `data-gk`), sonst lösen sie zusätzlich eine globale Aktion aus.
- **Dialoge:** `askModal(html, setup)`; Elemente mit `data-close` schließen automatisch.
- **Unwichtige Felder** in Formularen kommen in ein einklappbares `<details class="more">`.
- **Navigation:** Die Kategorien stehen in `NAV_ITEMS`; Wischen links/rechts wechselt zwischen ihnen.

## Datenmodell

- Sammlungen stehen im Array `COLL` (und gleichnamig im Objekt `S`): `years, fields, docs, atts, todos, exams, turnusTypes, turnusWeeks, turnusDays, events, notes, grades`.
- Jeder Eintrag hat `id, createdAt, updatedAt, deleted`. Immer über `add()`, `touch()`, `del()` ändern (setzt `updatedAt`, speichert, stößt Sync an). Gelöscht wird nur weich (`deleted: true`), damit der Sync die Löschung weitergeben kann.
- Schule vs. Alltag: Ein Lernfeld (`fields`) mit `yearId` gehört zur Schule, ohne `yearId` ist es eine Alltags-Kategorie.
- Lokale Speicherung: IndexedDB `schulvault` (aktuell Version 5). **Neue Sammlung anlegen:** in `COLL` und `S` eintragen und die Versionsnummer in `idbOpen()` um 1 erhöhen; Sync und Speicher übernehmen sie dann automatisch.
- `localStorage`: `sv_cfg` (Sync-Einstellungen inkl. Token des Nutzers, nur im Browser), `sv_last`, `sv_space`, `sv_notified`.
- Interne Namen wie `schulvault` (Datenbank, Cache, `app` in Sicherungen) stammen vom alten App-Namen. **Nicht umbenennen**, sonst sind vorhandene Daten weg.

## Sync-Daten (privates Repo `lifevault-daten`)

- `data.json` – alle Metadaten: `{ v: 1, app: 'schulvault', saved, years: [...], fields: [...], … }` (eine Liste pro Sammlung aus `COLL`)
- `files/<id>-<rev>` – Dateien und Fotos; `rev` ändert sich z. B. beim Drehen eines Fotos
- Abgleich pro Eintrag: die Version mit dem neueren `updatedAt` gewinnt. Einträge, die nur lokal existieren, werden wieder hochgeladen.

## Prüfen und Testen

- Syntax: Der Hook prüft nach jeder Änderung automatisch (siehe unten). Von Hand:
  `node .claude/hooks/check-syntax.js index.html sw.js manifest.webmanifest`
- Im Browser testen: `python3 -m http.server 8099` im Repo-Ordner (Windows: `py -m http.server 8099`), dann mit dem Playwright-MCP `http://localhost:8099/` öffnen. Es startet als Samsung Galaxy S24 (360 × 780, Touch) mit frischem, leerem Profil. Durchklicken, mit `browser_console_messages` auf Fehler achten und prüfen, dass `document.documentElement.scrollWidth` nicht breiter als das Fenster ist. Mit `browser_resize` zusätzlich 390 × 844 und den Desktop ab 900 px ansehen.
- Beim Testen nie den Sync mit echtem Token einrichten; Testdaten bleiben im Testbrowser.
- Die Texterkennung lädt Tesseract.js beim ersten Gebrauch von cdn.jsdelivr.net nach; offline oder ohne CDN-Zugriff zeigt sie eine Fehlermeldung, das ist erwartet.

## Veröffentlichen

- Veröffentlicht wird mit **`/release`** (startet nur Benny): Stand von GitHub holen, Cache-Version in `sw.js` hochzählen, Syntax und Datenformat prüfen, nach Tokens suchen, auf `main` pushen. GitHub Pages ist nach ca. einer Minute aktuell.
- Hochgeladen wird per `git push`, kein GitHub-MCP nötig (das bräuchte einen Token, und der gehört nicht in dieses öffentliche Repo).
- Der Service Worker (`sw.js`) lädt immer zuerst aus dem Netz, der Cache dient nur als Offline-Reserve. Erst eine geänderte `sw.js` (neue Cache-Version) lässt Handy und Laptop den neuen Service Worker installieren.

## Claude-Code-Einrichtung (`.claude/`, `.mcp.json`)

Die Hilfsskripte hier sind Werkzeuge für Claude Code, kein App-Code; die Regel „alles in `index.html`“ gilt für die App.

- **Token-Sperre** (`.claude/hooks/block-tokens.js`, vor jedem Schreiben/Bearbeiten/Shell-Befehl): blockiert alles, was wie ein GitHub-Token aussieht (`ghp_…`, `github_pat_…` usw.). Wenn er anschlägt: den Token entfernen, nicht umgehen.
- **Syntax-Prüfung** (`.claude/hooks/check-syntax.js`, nach jedem Schreiben/Bearbeiten): prüft den `<script>`-Block in `.html`, ganze `.js`-Dateien und `.json`/`.webmanifest`. Meldet sie einen Fehler mit Zeilennummer, sofort beheben.
- **Skill `/release`** (`.claude/skills/release/SKILL.md`): siehe „Veröffentlichen“.
- **Subagent `datenformat-pruefer`** (`.claude/agents/datenformat-pruefer.md`): prüft vor jedem Release und nach Änderungen am Datenmodell, ob alte Daten (IndexedDB, `data.json`, Sicherungen) weiter funktionieren – statisch und mit einem Upgrade-Test alte → neue Version.
- **Playwright-MCP** (`.mcp.json`): Browser für Tests in Handygröße, siehe „Prüfen und Testen“. Beim ersten Start fragt Claude Code einmal nach Freigabe. Läuft die Sitzung als root (manche Cloud-Umgebungen) und Chromium meldet „sandboxing failed“, startet der MCP-Browser dort nicht; dann mit einem eigenen Playwright-Skript und `chromiumSandbox: false` testen.
- `.gitignore` hält Sicherungen (`lifevault-daten*`), `.claude/settings.local.json` und Testausgaben aus dem Repo.
