---
name: release
description: LifeVault veröffentlichen – Stand holen, Cache-Version im Service Worker hochzählen, Syntax und Datenformat prüfen, nach Tokens suchen, auf main pushen (GitHub Pages).
disable-model-invocation: true
argument-hint: "[kurz, was sich geändert hat]"
allowed-tools: Bash(git status *) Bash(git fetch *) Bash(git pull *) Bash(git diff *) Bash(git rev-list *) Bash(git log *) Bash(git add *) Bash(git grep *) Bash(git commit *) Bash(git push origin main) Bash(node .claude/hooks/check-syntax.js *)
---

# LifeVault veröffentlichen

Veröffentliche den aktuellen Stand von LifeVault. Beschreibung der Änderung (kann leer sein): $ARGUMENTS

Arbeite die Schritte der Reihe nach ab. Wenn ein Schritt scheitert: **abbrechen**, Benny kurz auf Deutsch sagen, was los ist, und nicht pushen. Niemals `git push --force`, keine Branches wechseln, nichts löschen.

## 1. Stand holen

Benny ändert LifeVault auch im Chat und vom Handy aus. Deshalb zuerst den Stand von GitHub holen:

1. `git status --short` und `git fetch origin main`
2. `git rev-list --left-right --count HEAD...origin/main` – steht rechts eine Zahl größer 0, gibt es auf GitHub neuere Commits: `git pull --rebase --autostash origin main`. Bei einem Konflikt abbrechen und Benny die betroffenen Stellen zeigen.
3. Was wird veröffentlicht? `git diff --stat origin/main` plus neue Dateien aus `git status --short`. Ist beides leer: „Nichts zu veröffentlichen“ melden und aufhören.

## 2. Nur erlaubte Dateien (das Repo ist öffentlich)

Hochgeladen werden dürfen nur:

- App: `index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png`, `icon.svg`, `icon-maskable.svg`
- Push-Dienst: `dienst/erinnerungen.mjs` (läuft im Daten-Repo als GitHub Action, enthält keine Daten oder Schlüssel)
- Projekt: `CLAUDE.md`, `.gitignore`, `.mcp.json`, alles unter `.claude/` außer `.claude/settings.local.json`

Liegt etwas anderes geändert oder neu im Ordner (z. B. `lifevault-daten-….json`-Sicherungen, Screenshots, `.playwright-mcp/`, Testdaten): **nicht** hinzufügen, Benny fragen. Sicherungen und Testdaten enthalten echte Einträge und gehören nie ins Repo.

## 3. Cache-Version hochzählen

Nur wenn sich App-Dateien geändert haben (`index.html`, `sw.js`, `manifest.webmanifest`, Icons):

- In `sw.js` die Zeile `const CACHE = 'schulvault-vN';` auf N + 1 setzen (z. B. `schulvault-v2` → `schulvault-v3`).
- Der Name `schulvault` bleibt, nur die Zahl ändert sich.
- Kam eine neue App-Datei dazu (z. B. ein Icon), sie auch in `ASSETS` in `sw.js` eintragen.

Warum: Erst eine geänderte `sw.js` bringt Handy und Laptop dazu, den neuen Service Worker zu installieren und den alten Cache zu löschen.

## 4. Syntax prüfen

```
node .claude/hooks/check-syntax.js index.html sw.js manifest.webmanifest dienst/erinnerungen.mjs
```

Alle Zeilen müssen mit ✓ beginnen. Bei ✗: Fehler beheben und diesen Schritt wiederholen.

## 5. Datenformat prüfen

Wenn `git diff origin/main -- index.html` nicht leer ist: den Subagenten **datenformat-pruefer** starten und ihm sagen, dass die Vergleichsbasis `origin/main` ist.

- Urteil **Blockiert**: abbrechen, Befunde zeigen, Benny fragen.
- Urteil **Hinweise**: Befunde kurz zeigen und weitermachen, außer ein Hinweis betrifft vorhandene Daten auf Handy, Laptop oder im Daten-Repo – dann fragen.
- Urteil **OK**: weiter.

## 6. Nach Tokens suchen

1. Die erlaubten Dateien einzeln mit `git add <datei>` vormerken (nicht `git add -A`).
2. `git diff --cached --name-only` – nur Dateien aus Schritt 2?
3. Suche in allem, was hochgeladen würde:
   ```
   git grep --cached -nE 'github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,}'
   ```
   Findet der Befehl nichts (Exit-Code 1), ist alles gut. Findet er etwas: sofort abbrechen, die Fundstelle nennen (den Token selbst nicht ausgeben), `git restore --staged <datei>` und Benny Bescheid geben.

## 7. Commit und Push

1. Commit-Nachricht auf Deutsch: die Beschreibung von oben, sonst eine kurze Zusammenfassung aus dem Diff. Bei neuer Cache-Version am Ende z. B. „(Cache schulvault-v3)“ anhängen.
2. `git commit -m "…"`, dann `git push origin main`.
3. Wird der Push abgelehnt, weil inzwischen jemand anderes gepusht hat: `git pull --rebase origin main`, Schritt 4 wiederholen, erneut pushen.

## 8. Abschluss

Kurz melden:

- Commit (Kurz-Hash) und die neue Cache-Version
- welche Dateien hochgeladen wurden
- „In ca. einer Minute ist die neue Version unter https://benschgo.github.io/LifeVault/ online. Auf dem Handy die App einmal ganz schließen und neu öffnen.“
