#!/usr/bin/env node
// Syntax-Prüfung für LifeVault.
//
// 1) Als PostToolUse-Hook (automatisch nach Write/Edit/MultiEdit):
//    liest das Hook-JSON von stdin und prüft die gerade geänderte Datei.
//    Exit-Code 2 = Fehler gefunden; die Meldung auf stderr bekommt Claude zu sehen.
// 2) Von Hand oder im /release-Skill:
//    node .claude/hooks/check-syntax.js index.html sw.js manifest.webmanifest
//    Exit-Code 1 = mindestens eine Datei fehlerhaft.
//
// Geprüft wird:
//   .html  → jeder eingebettete <script>-Block (ohne src), Zeilennummern passend zur HTML-Datei
//   .js    → die ganze Datei
//   .json / .webmanifest → gültiges JSON
// Der Code wird nur übersetzt, nicht ausgeführt.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const newlinesBefore = (text, idx) => {
  let n = 0;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

// Gibt null zurück, wenn alles passt, sonst { line, msg, snippet }.
function checkJs(code, file, lineOffset) {
  try {
    new vm.Script(code, { filename: file, lineOffset });
    return null;
  } catch (e) {
    if (!e || e.name !== 'SyntaxError') return null; // nur echte Syntaxfehler melden
    // V8 stellt dem Stack "datei:zeile", die Codezeile und eine Markierung (^^^) voran.
    const lines = String(e.stack || '').split('\n');
    const m = lines[0].match(/:(\d+)\s*$/);
    const snippet = m ? lines.slice(1, 3).filter(l => l.trim()).map(l => l.slice(0, 160)).join('\n') : '';
    return { line: m ? Number(m[1]) : null, msg: e.message, snippet };
  }
}

function checkJson(text) {
  try { JSON.parse(text); return null; }
  catch (e) {
    const pos = Number((String(e.message).match(/position (\d+)/) || [])[1]);
    return { line: Number.isFinite(pos) ? newlinesBefore(text, pos) + 1 : null, msg: e.message, snippet: '' };
  }
}

// Liefert eine Liste von Fehlern für eine Datei (leer = OK) oder null, wenn der Dateityp nicht geprüft wird.
function checkFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.html', '.htm', '.js', '.cjs', '.json', '.webmanifest'].includes(ext)) return null;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; } // Datei weg (gelöscht/umbenannt): nichts zu prüfen
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  if (ext === '.json' || ext === '.webmanifest') {
    const err = checkJson(text);
    return err ? [err] : [];
  }
  if (ext === '.js' || ext === '.cjs') {
    const err = checkJs(text, file, 0);
    return err ? [err] : [];
  }

  // HTML: alle eingebetteten Skripte prüfen. Nicht gierig, genau wie der Browser:
  // das erste </script> beendet den Block.
  const errors = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = ((attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '').toLowerCase();
    const start = m.index + m[0].indexOf('>') + 1;
    const offset = newlinesBefore(text, start);
    if (type && /json/.test(type)) {
      const err = checkJson(m[2]);
      if (err) errors.push(Object.assign(err, { line: err.line ? err.line + offset : null }));
      continue;
    }
    if (type && !/^(text\/javascript|application\/javascript|javascript)$/.test(type)) continue; // z. B. type="module" oder Vorlagen
    const err = checkJs(m[2], file, offset);
    if (err) errors.push(err);
  }
  return errors;
}

function describe(file, err) {
  const where = err.line ? `, Zeile ${err.line}` : '';
  return `${path.basename(file)}${where}: ${err.msg}` + (err.snippet ? `\n${err.snippet}` : '');
}

// ---------- Modus 2: Dateien als Argumente ----------
const args = process.argv.slice(2);
if (args.length) {
  let bad = false;
  for (const f of args) {
    const res = checkFile(f);
    if (res === null) {
      if (!fs.existsSync(f)) { console.error(`✗ ${f}: Datei nicht gefunden`); bad = true; }
      else console.log(`– ${f}: Dateityp wird nicht geprüft`);
    } else if (res.length) {
      bad = true;
      res.forEach(err => console.error(`✗ ${describe(f, err)}`));
    } else {
      console.log(`✓ ${f}: Syntax OK`);
    }
  }
  process.exit(bad ? 1 : 0);
}

// ---------- Modus 1: PostToolUse-Hook ----------
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); } // kein gültiges JSON: nicht stören
  const ti = data.tool_input || {};
  const file = ti.file_path || ti.notebook_path;
  if (typeof file !== 'string' || !file) process.exit(0);
  const res = checkFile(file);
  if (!res || !res.length) process.exit(0);
  const isApp = /index\.html?$/i.test(file) || /sw\.js$/i.test(file);
  process.stderr.write(
    `Syntax-Prüfung: FEHLER nach ${data.tool_name || 'Änderung'} → ${res.map(err => describe(file, err)).join('\n')}\n` +
    (isApp
      ? 'So startet LifeVault nicht (weißer Bildschirm auf Handy und Laptop). Behebe den Fehler sofort, bevor du weitermachst.\n'
      : 'Die Datei ist so nicht gültig. Behebe den Fehler, bevor du weitermachst.\n')
  );
  process.exit(2);
});
