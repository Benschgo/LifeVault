---
name: release
description: LifeVault veröffentlichen – Stand holen, Versionsnummer nach Größe des Updates erhöhen, Cache-Version im Service Worker hochzählen, Syntax und Datenformat prüfen, nach Tokens suchen, auf main pushen (GitHub Pages).
disable-model-invocation: true
argument-hint: "[kurz, was sich geändert hat]"
allowed-tools: Bash(git status *) Bash(git fetch *) Bash(git pull *) Bash(git diff *) Bash(git rev-list *) Bash(git log *) Bash(git describe *) Bash(git rev-parse *) Bash(git tag *) Bash(git add *) Bash(git grep *) Bash(git commit *) Bash(git push origin main) Bash(git push origin v*) Bash(node .claude/hooks/check-syntax.js *)
---

# LifeVault veröffentlichen

Veröffentliche den aktuellen Stand von LifeVault. Beschreibung der Änderung (kann leer sein): $ARGUMENTS

Arbeite die Schritte der Reihe nach ab. Wenn ein Schritt scheitert: **abbrechen**, Benny kurz auf Deutsch sagen, was los ist, und nicht pushen. Niemals `git push --force`, keine Branches wechseln, nichts löschen (auch keine Tags).

## 1. Stand holen

Benny ändert LifeVault auch im Chat und vom Handy aus. Deshalb zuerst den Stand von GitHub holen:

1. `git status --short` und `git fetch --tags origin main`. Ist der Klon flach (`git rev-parse --is-shallow-repository` gibt `true`), zuerst `git fetch --unshallow origin` – sonst fehlt die ältere Geschichte für die Versionsnummer.
2. `git rev-list --left-right --count HEAD...origin/main` – steht rechts eine Zahl größer 0, gibt es auf GitHub neuere Commits: `git pull --rebase --autostash origin main`. Bei einem Konflikt abbrechen und Benny die betroffenen Stellen zeigen.
3. Was wird veröffentlicht? `git diff --stat origin/main` plus neue Dateien aus `git status --short`. Ist beides leer: „Nichts zu veröffentlichen“ melden und aufhören.

## 2. Nur erlaubte Dateien (das Repo ist öffentlich)

Hochgeladen werden dürfen nur:

- App: `index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png`, `icon.svg`, `icon-maskable.svg`
- Push-Dienst: `dienst/erinnerungen.mjs` (läuft im Daten-Repo als GitHub Action, enthält keine Daten oder Schlüssel)
- Projekt: `CLAUDE.md`, `.gitignore`, `.mcp.json`, alles unter `.claude/` außer `.claude/settings.local.json`

Liegt etwas anderes geändert oder neu im Ordner (z. B. `lifevault-daten-….json`-Sicherungen, Screenshots, `.playwright-mcp/`, Testdaten): **nicht** hinzufügen, Benny fragen. Sicherungen und Testdaten enthalten echte Einträge und gehören nie ins Repo.

## 3. Versionsnummer festlegen

Die Version steht in `index.html` in der Zeile `const APP_VERSION = 'X.Y.Z';` und erscheint unten in den Optionen („LifeVault X.Y.Z“). Zu jeder veröffentlichten Version gibt es einen Git-Tag `vX.Y.Z`.

1. **Ausgangspunkt:** neuester Tag (`git describe --tags --abbrev=0`) und `APP_VERSION` in `index.html` – die **höhere** der beiden Nummern gilt. (Lädt Benny eine `index.html` aus einem anderen Chat hoch, kann dort eine ältere Nummer stehen; die Version darf nie zurückgehen.)
2. **Was ist seit der letzten Version neu?** `git log --oneline <letzter-tag>..HEAD` und `git diff --stat <letzter-tag>` plus die Änderungen, die jetzt hochgeladen werden. Alles, was seit dem letzten Tag dazukam, gehört in diese Version.
3. **Stufe selbst entscheiden** – maßgeblich ist, was Benny in der App merkt, nicht wie viel Code sich geändert hat:
   - **Groß** (erste Zahl +1, Rest 0, z. B. 2.4.1 → 3.0.0): Die App sieht grundlegend anders aus oder arbeitet anders – komplette Neugestaltung, neuer großer Bereich, Umbau von Datenformat oder Sync, oder etwas, das eine Neueinrichtung auf den Geräten braucht.
   - **Mittel** (zweite Zahl +1, letzte 0, z. B. 2.4.1 → 2.5.0): neue Funktion, oder eine Ansicht/ein Ablauf wurde spürbar überarbeitet, oder mehrere kleinere Verbesserungen zusammen, die man deutlich merkt.
   - **Klein** (letzte Zahl +1, z. B. 2.4.1 → 2.4.2): Fehler behoben, kleine Anpassung an Text, Farbe, Abstand oder Verhalten, technische Korrektur ohne neue Funktion.
   - **Keine neue Nummer:** Es ändert sich nichts an der App oder am Push-Dienst, nur an Werkzeugen und Notizen (`CLAUDE.md`, `.claude/`, `.gitignore`, `.mcp.json`). Dann `APP_VERSION` nicht anfassen und keinen Tag setzen.
   - Mehrere Änderungen in einem Upload: die größte entscheidet. Im Zweifel die kleinere Stufe. Nie Nummern überspringen.
4. **Eintragen:** `APP_VERSION` in `index.html` auf die neue Nummer setzen. Die Nummer und die Stufe mit einem Halbsatz Begründung merken (für Commit, Tag und Abschlussmeldung).

Bisherige Versionen zur Orientierung:

| Version | Datum | Stufe | Inhalt |
|---|---|---|---|
| 1.0.0 | 23.09.2026 | – | erster Upload: Schule und Alltag, Unterlagen, Aufgaben, Kalender, Sync |
| 1.0.1 | 23.09.2026 | klein | mehr Erinnerungs-Abstände, Lernfeld/Kategorie direkt im Dialog anlegen |
| 2.0.0 | 24.09.2026 | groß | neue Startseite, neuer Bereich Notizen, Inhalte zusammengefasst, Schule/Alltag-Filter, Feiertage nach Bundesland, Turnus-Tage einzeln änderbar |
| 2.1.0 | 24.09.2026 | mittel | Wochenleiste und Aufgaben-Abschnitt auf der Startseite |
| 2.2.0 | 25.09.2026 | mittel | Wischen zwischen Kategorien, zugeordnete Notizen im Lernfeld |
| 2.3.0 | 16.11.2026 | mittel | Noten, Texterkennung (OCR), Übersicht im Lernfeld |
| 2.3.1 | 16.11.2026 | klein | Feiertage: nur echte freie Tage je Bundesland |
| 3.0.0 | 17.11.2026 | groß | neues Layout „Werkstatt“, Rot als Hausfarbe, neuer Hintergrund, „Optionen“, Tresor-Symbol |
| 3.1.0 | 17.11.2026 | mittel | Kalender übersichtlicher, kein Wischen zwischen Kategorien, Plus-Taster am PC, dunkle Android-Leiste |
| 3.1.1 | 17.11.2026 | klein | Symbol-Adressen mit Versionsangabe, damit Android das neue Symbol übernimmt |
| 3.2.0 | 17.11.2026 | mittel | Push-Erinnerungen auch bei geschlossener App, Versionsnummer wird gepflegt |

Ohne eigene Nummer: der zweite Upload am 24.09. (dieselben Dateien noch einmal) und die Claude-Code-Einrichtung am 16.11. (an der App hat sich nichts geändert). Neue Versionen hier unten in der Tabelle ergänzen.

## 4. Cache-Version hochzählen

Nur wenn sich App-Dateien geändert haben (`index.html`, `sw.js`, `manifest.webmanifest`, Icons):

- In `sw.js` die Zeile `const CACHE = 'schulvault-vN';` auf N + 1 setzen (z. B. `schulvault-v2` → `schulvault-v3`).
- Der Name `schulvault` bleibt, nur die Zahl ändert sich. Die Cache-Nummer ist unabhängig von der Versionsnummer.
- Kam eine neue App-Datei dazu (z. B. ein Icon), sie auch in `ASSETS` in `sw.js` eintragen.

Warum: Erst eine geänderte `sw.js` bringt Handy und Laptop dazu, den neuen Service Worker zu installieren und den alten Cache zu löschen.

## 5. Syntax prüfen

```
node .claude/hooks/check-syntax.js index.html sw.js manifest.webmanifest dienst/erinnerungen.mjs
```

Alle Zeilen müssen mit ✓ beginnen. Bei ✗: Fehler beheben und diesen Schritt wiederholen.

## 6. Datenformat prüfen

Wenn `git diff origin/main -- index.html` mehr als die Versionszeile ändert: den Subagenten **datenformat-pruefer** starten und ihm sagen, dass die Vergleichsbasis `origin/main` ist.

- Urteil **Blockiert**: abbrechen, Befunde zeigen, Benny fragen.
- Urteil **Hinweise**: Befunde kurz zeigen und weitermachen, außer ein Hinweis betrifft vorhandene Daten auf Handy, Laptop oder im Daten-Repo – dann fragen.
- Urteil **OK**: weiter.

## 7. Nach Tokens suchen

1. Die erlaubten Dateien einzeln mit `git add <datei>` vormerken (nicht `git add -A`).
2. `git diff --cached --name-only` – nur Dateien aus Schritt 2?
3. Suche in allem, was hochgeladen würde:
   ```
   git grep --cached -nE 'github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,}'
   ```
   Findet der Befehl nichts (Exit-Code 1), ist alles gut. Findet er etwas: sofort abbrechen, die Fundstelle nennen (den Token selbst nicht ausgeben), `git restore --staged <datei>` und Benny Bescheid geben.

## 8. Commit, Tag und Push

1. Commit-Nachricht auf Deutsch, beginnend mit „Release X.Y.Z: “ und dann die Beschreibung von oben, sonst eine kurze Zusammenfassung aus dem Diff. Bei neuer Cache-Version am Ende z. B. „(Cache schulvault-v3)“ anhängen. Ohne neue Versionsnummer (Schritt 3): „Release: …“.
2. `git commit -m "…"`, dann `git push origin main`.
3. Wird der Push abgelehnt, weil inzwischen jemand anderes gepusht hat: `git pull --rebase origin main`, Schritt 5 wiederholen, erneut pushen.
4. Mit neuer Versionsnummer: `git tag -a vX.Y.Z -m "X.Y.Z (Stufe): kurz, was neu ist"` auf den gerade gepushten Commit, dann `git push origin vX.Y.Z`. Scheitert nur der Tag-Push, ist die Veröffentlichung trotzdem gültig – in der Abschlussmeldung erwähnen.

## 9. Abschluss

Kurz melden:

- neue Version (z. B. „Version 2.3.0 – mittleres Update, weil …“) bzw. „keine neue Versionsnummer, nur Werkzeuge“
- Commit (Kurz-Hash) und die neue Cache-Version
- welche Dateien hochgeladen wurden
- „In ca. einer Minute ist die neue Version unter https://benschgo.github.io/LifeVault/ online. Auf dem Handy die App einmal ganz schließen und neu öffnen.“
