# LifeVault

Persönliche PWA für Schule und Alltag: Unterlagen (mit Fotos/Dateien), Notizen, Aufgaben, Noten, Kalender. Läuft über GitHub Pages direkt aus diesem Repo (Branch `main`), installierbar auf Handy (Samsung/Android) und Laptop.

## Grundregeln

- **Alles bleibt in `index.html`.** Kein Framework, keine Abhängigkeiten, kein Build-Schritt. CSS steht im `<style>`-Block, das gesamte JavaScript in dem einen `<script>`-Block. Keine neuen Dateien für Code anlegen.
- **Oberfläche auf Deutsch**, Ansprache mit „du“. Texte kurz und alltagstauglich.
- **Mobil zuerst:** Jede Änderung muss auf 360–390 px Breite gut aussehen (kein horizontales Scrollen). Desktop ab 900 px hat eine Seitenleiste.
- **Datenformat nie ändern, ohne alte Daten automatisch umzuwandeln.** Bestehende Einträge auf Handy, Laptop und im Daten-Repo müssen nach jedem Update weiter funktionieren. Neue Felder immer optional behandeln (`x.feld || ''`).
- **Dieses Repo ist öffentlich.** Niemals Tokens, Passwörter oder echte Daten committen. Ein Hook blockiert Text, der wie ein GitHub-Token aussieht (siehe unten).

## Aufbau von `index.html`

Das Skript ist in Abschnitte gegliedert, jeweils mit einem `/* ===== … ===== */`-Kommentar:

1. **Kernlogik** – Datenmodell, IndexedDB, Hilfsfunktionen, Feiertage, Turnus, Noten, Benachrichtigungen
2. **Sync** – Abgleich mit dem privaten Daten-Repo über die GitHub-API
3. **Oberfläche Teil 1** – Dialoge, Router, Start (Dashboard), Inhalte, Schuljahr, Lernfeld, Unterlage
4. **Oberfläche Teil 2** – Aufgaben, Notizen, Suche, Einstellungen, Foto-Viewer, OCR, Aktionen (`ACT`), `init()`
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

- Syntax nach jeder Änderung prüfen:
  `node -e "const s=require('fs').readFileSync('index.html','utf8'); new Function(s.match(/<script>([\s\S]*)<\/script>/)[1]); console.log('Syntax OK')"`
- Im Browser testen: `python3 -m http.server 8099` im Repo-Ordner, dann mit Playwright in Handygröße (390 × 844, `isMobile`, `hasTouch`, `locale: 'de-DE'`) durchklicken und auf Konsolenfehler achten.
- Die Texterkennung lädt Tesseract.js beim ersten Gebrauch von cdn.jsdelivr.net nach; offline oder ohne CDN-Zugriff zeigt sie eine Fehlermeldung, das ist erwartet.

## Veröffentlichen

- Änderungen auf `main` pushen → GitHub Pages ist nach ca. einer Minute aktuell.
- Der Service Worker (`sw.js`) lädt immer zuerst aus dem Netz, der Cache dient nur als Offline-Reserve.

## Hooks in `.claude/`

- **Token-Sperre** (`.claude/hooks/block-tokens.js`): blockiert Schreiben, Bearbeiten und Shell-Befehle, die wie ein GitHub-Token aussehen (`ghp_…`, `github_pat_…` usw.). Wenn er anschlägt: den Token entfernen, nicht umgehen.
