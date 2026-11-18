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
- Leisten (Titelleiste oben, Menüleiste unten bzw. Seitenleiste am PC): rotes Zahlenrad um das Sync-Symbol (`--dial`), feine Leiterbahnen (`--trace`, `--trace-v`) und ein warmer „Lichtspalt“ an der Kante (`--seam`, `--seam-glow`) – Zahlenrad und Lichtspalt stammen aus dem App-Symbol. Rein dekorativ (Hintergrund bzw. Pseudo-Elemente ohne Klicks).
- Startbildschirm `#splash` (nur installierte App, `display-mode: standalone`): folgt auf Androids einfarbigen Start (`background_color`), Zahlenrad rastet ein, verschwindet über `hideSplash()` nach ca. 1 s, spätestens nach 4 s per CSS. Eine Grafik direkt auf Androids eigenem Startbild geht nicht, dort gibt es nur Farbe + Symbol.
- Kalenderfläche (`.cal-panel.bild`, nur Dunkelmodus): Bennys Bild `kalender-bild.webp` (Bergsee bei Nacht, roter Mond) liegt nur hinter dem Kalender selbst (`.cal-bild` um das Raster), die Legende darunter bleibt auf der normalen Fläche. Dunkler Verlauf, Tage halb durchsichtig, Zahlen mit Schatten. Entfernen: CSS-Block „Kalender-Hintergrundbild“, Klasse `bild` in `vCalMonth()` und die Datei.
- Freie Tage (Feiertage) schraffiert über `--hatch`. Turnus-Arten als Farbband (Startseite) bzw. Tönung (Monatskalender).
- Umschalter (`.seg`, `.tabs`, `.chip.btnlike`) wie Wahlschalter: aktive Stellung in Tusche gefüllt.
- `manifest.webmanifest`: `theme_color` `#19212a` und `background_color` `#10151b` (dunkel). Chrome färbt damit bei der installierten App die Android-Leiste unten und das Startbild; Benny nutzt den Dunkelmodus, daher nicht hell machen. Änderungen daran kommen auf dem Handy erst an, wenn Chrome die installierte App aktualisiert (kann ein bis zwei Tage dauern).
- App-Symbol „Tresor“ (Tresortür mit rotem Zahlenrad, Lichtspalt, Unterlagen dahinter). Quellen: `icon.svg` (Kachel mit Neonkante → `icon-192.png`, `icon-512.png`, auch Logo in der Seitenleiste) und `icon-maskable.svg` (randlos für Android → `icon-maskable-512.png`). PNGs bei Änderungen aus den SVGs neu rendern (1024 px, dann verkleinern). **Bei einem neuen Symbol immer die Versionsangabe an den Bildadressen ändern** (`?v=tresor` → neuer Name) in `manifest.webmanifest` und `index.html` (Favicon, Apple-Touch-Icon, Seitenleisten-Logo): Chrome für Android lädt neue Symbole nur, wenn sich die Adresse im Manifest ändert, und lässt sie vom Nutzer bestätigen.

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
- **Navigation:** Die Kategorien stehen in `NAV_ITEMS`. Gewechselt wird **nur** über die Leiste (unten bzw. links); Wischen zwischen Kategorien ist bewusst abgeschaltet (Bennys Wunsch). Wischen gibt es nur im Foto-Viewer zum Blättern.

## Datenmodell

- Sammlungen stehen im Array `COLL` (und gleichnamig im Objekt `S`): `years, fields, docs, atts, todos, exams, turnusTypes, turnusWeeks, turnusDays, events, notes, grades`.
- Jeder Eintrag hat `id, createdAt, updatedAt, deleted`. Immer über `add()`, `touch()`, `del()` ändern (setzt `updatedAt`, speichert, stößt Sync an). Gelöscht wird nur weich (`deleted: true`), damit der Sync die Löschung weitergeben kann.
- Schule vs. Alltag: Ein Lernfeld (`fields`) mit `yearId` gehört zur Schule, ohne `yearId` ist es eine Alltags-Kategorie.
- Lokale Speicherung: IndexedDB `schulvault` (aktuell Version 5). **Neue Sammlung anlegen:** in `COLL` und `S` eintragen und die Versionsnummer in `idbOpen()` um 1 erhöhen; Sync und Speicher übernehmen sie dann automatisch.
- `localStorage`: `sv_cfg` (Sync-Einstellungen inkl. Token des Nutzers, nur im Browser), `sv_last`, `sv_space`, `sv_notified`, `sv_push` (Push auf diesem Gerät: `{ on, id, endpoint, checked }`).
- Cache `sv-push-seen` (App und Service Worker): schon gezeigte Erinnerungs-Schlüssel, damit Push und lokale Meldung nicht doppelt piepen. Der Service Worker darf ihn beim Aktivieren nicht löschen.
- Interne Namen wie `schulvault` (Datenbank, Cache, `app` in Sicherungen) stammen vom alten App-Namen. **Nicht umbenennen**, sonst sind vorhandene Daten weg.

## Sync-Daten (privates Repo `lifevault-daten`)

- `data.json` – alle Metadaten: `{ v: 1, app: 'schulvault', saved, years: [...], fields: [...], … }` (eine Liste pro Sammlung aus `COLL`)
- `files/<id>-<rev>` – Dateien und Fotos; `rev` ändert sich z. B. beim Drehen eines Fotos
- Abgleich pro Eintrag: die Version mit dem neueren `updatedAt` gewinnt. Einträge, die nur lokal existieren, werden wieder hochgeladen.
- `push/` – Push-Erinnerungen (siehe unten); der Sync fasst nur `data.json` und `files/` an.

## Push-Erinnerungen (auch bei geschlossener App)

- Ein GitHub-Workflow im Daten-Repo (`.github/workflows/erinnerungen.yml`, Cron `7,37 * * * *`, ca. 1 Action-Minute pro Lauf) holt `dienst/erinnerungen.mjs` aus **diesem** Repo und führt es aus. Änderungen am Dienst kommen also mit dem nächsten Push auf `main` an.
- Der Dienst nutzt dieselben Regeln, Schlüssel (`t:<id>:<due>`, `e:<id>:<date>`, `ev:<id>:<occ>`) und Texte wie `checkNotifications()` in `index.html`. **Wer `triggerTs`, `nextOccurrence`, `eventOccursOn`, `fmtDue` oder `checkNotifications` ändert, zieht `dienst/erinnerungen.mjs` mit.** Nur pro Eintrag eingestellte Erinnerungen (`remind` gesetzt), keine automatischen.
- Dateien im Daten-Repo: `push/vapid.json` (Push-Schlüssel, legt die App beim ersten „Push aktivieren“ an), `push/geraete.json` (ein Eintrag pro Gerät, schreibt **nur die App**), `push/status.json` (gesendet, abgelaufene Abos, erledigte Tests; schreibt **nur der Dienst**). So kommen sich App und Dienst nicht in die Quere.
- Zeitfenster: sendet bis 30 Min. vor dem Zeitpunkt, holt bis 3 Std. danach nach; beim allerersten Lauf wird Vergangenes nur abgehakt. Abos mit Antwort 404/410 gelten als abgelaufen; die App meldet sich beim nächsten Start still neu an (`pushCheck`).
- Keine Abhängigkeiten: Verschlüsselung (RFC 8291) und VAPID mit `node:crypto`. Testen ohne echte Daten: Ordner mit erfundener `data.json` + `push/*.json` anlegen, `LV_DIR=<ordner> LV_NOW=<ms> node dienst/erinnerungen.mjs`, `fetch` im Test durch eine Attrappe ersetzen.

## Prüfen und Testen

- Syntax: Der Hook prüft nach jeder Änderung automatisch (siehe unten). Von Hand:
  `node .claude/hooks/check-syntax.js index.html sw.js manifest.webmanifest dienst/erinnerungen.mjs`
- Im Browser testen: `python3 -m http.server 8099` im Repo-Ordner (Windows: `py -m http.server 8099`), dann mit dem Playwright-MCP `http://localhost:8099/` öffnen. Es startet als Samsung Galaxy S24 (360 × 780, Touch) mit frischem, leerem Profil. Durchklicken, mit `browser_console_messages` auf Fehler achten und prüfen, dass `document.documentElement.scrollWidth` nicht breiter als das Fenster ist. Mit `browser_resize` zusätzlich 390 × 844 und den Desktop ab 900 px ansehen.
- Beim Testen nie den Sync mit echtem Token einrichten; Testdaten bleiben im Testbrowser.
- Die Texterkennung lädt Tesseract.js beim ersten Gebrauch von cdn.jsdelivr.net nach; offline oder ohne CDN-Zugriff zeigt sie eine Fehlermeldung, das ist erwartet.

## Veröffentlichen

- Veröffentlicht wird mit **`/release`** (startet nur Benny): Stand von GitHub holen, Versionsnummer festlegen, Cache-Version in `sw.js` hochzählen, Syntax und Datenformat prüfen, nach Tokens suchen, auf `main` pushen. GitHub Pages ist nach ca. einer Minute aktuell.
- **Versionsnummer** `APP_VERSION` in `index.html` (unten in den Optionen sichtbar), Schema Groß.Mittel.Klein: Jede Veröffentlichung mit einer Änderung an der App oder am Push-Dienst erhöht sie – die Stufe entscheidet Claude nach dem, was Benny merkt (Kriterien und Tabelle aller Versionen in `.claude/skills/release/SKILL.md`, Schritt 3). Die Nummer geht nie zurück.
- Hochgeladen wird per `git push`, kein GitHub-MCP nötig (das bräuchte einen Token, und der gehört nicht in dieses öffentliche Repo).
- Der Service Worker (`sw.js`) lädt immer zuerst aus dem Netz, der Cache dient nur als Offline-Reserve. Erst eine geänderte `sw.js` (neue Cache-Version) lässt Handy und Laptop den neuen Service Worker installieren.

## Claude-Code-Einrichtung (`.claude/`, `.mcp.json`)

Die Hilfsskripte hier sind Werkzeuge für Claude Code, kein App-Code; die Regel „alles in `index.html`“ gilt für die App. Ausnahme mit eigenem Ordner: `dienst/` (läuft in GitHub Actions, nicht im Browser).

- **Token-Sperre** (`.claude/hooks/block-tokens.js`, vor jedem Schreiben/Bearbeiten/Shell-Befehl): blockiert alles, was wie ein GitHub-Token aussieht (`ghp_…`, `github_pat_…` usw.). Wenn er anschlägt: den Token entfernen, nicht umgehen.
- **Syntax-Prüfung** (`.claude/hooks/check-syntax.js`, nach jedem Schreiben/Bearbeiten): prüft den `<script>`-Block in `.html`, ganze `.js`-Dateien und `.json`/`.webmanifest`. Meldet sie einen Fehler mit Zeilennummer, sofort beheben.
- **Skill `/release`** (`.claude/skills/release/SKILL.md`): siehe „Veröffentlichen“.
- **Subagent `datenformat-pruefer`** (`.claude/agents/datenformat-pruefer.md`): prüft vor jedem Release und nach Änderungen am Datenmodell, ob alte Daten (IndexedDB, `data.json`, Sicherungen) weiter funktionieren – statisch und mit einem Upgrade-Test alte → neue Version.
- **Playwright-MCP** (`.mcp.json`): Browser für Tests in Handygröße, siehe „Prüfen und Testen“. Beim ersten Start fragt Claude Code einmal nach Freigabe. Läuft die Sitzung als root (manche Cloud-Umgebungen) und Chromium meldet „sandboxing failed“, startet der MCP-Browser dort nicht; dann mit einem eigenen Playwright-Skript und `chromiumSandbox: false` testen.
- `.gitignore` hält Sicherungen (`lifevault-daten*`), `.claude/settings.local.json` und Testausgaben aus dem Repo.
