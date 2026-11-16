#!/usr/bin/env node
// Token-Sperre für Claude Code (PreToolUse-Hook).
// Blockiert Write/Edit/MultiEdit/NotebookEdit und Bash-Befehle, deren Inhalt wie ein GitHub-Token aussieht.
// Dieses Repo ist öffentlich: Ein Token im Code wäre für jeden sichtbar.
// Exit-Code 2 = Aktion blockieren; die Meldung auf stderr bekommt Claude zu sehen.

const PATTERNS = [
  { name: 'GitHub-Token (fein granular, github_pat_…)', re: /github_pat_[A-Za-z0-9_]{40,}/ },
  { name: 'GitHub-Token (klassisch, ghp_/gho_/ghu_/ghs_/ghr_…)', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ }
];

function collectText(input) {
  if (!input || typeof input !== 'object') return [];
  const parts = [input.content, input.new_string, input.new_source, input.command];
  if (Array.isArray(input.edits)) input.edits.forEach(e => parts.push(e && e.new_string));
  return parts.filter(p => typeof p === 'string');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); } // kein gültiges JSON: nicht blockieren
  const texts = collectText(data.tool_input);
  for (const t of texts) {
    for (const p of PATTERNS) {
      if (p.re.test(t)) {
        const where = (data.tool_input && (data.tool_input.file_path || data.tool_input.notebook_path)) || 'Shell-Befehl';
        process.stderr.write(
          `Token-Sperre: Blockiert (${data.tool_name || 'Tool'} → ${where}). Gefunden: ${p.name}.\n` +
          'Das LifeVault-Repo ist öffentlich, Tokens dürfen nie in Dateien oder Befehle geschrieben werden. ' +
          'Entferne den Token und nutze einen Platzhalter (z. B. "github_pat_…"). Der echte Token gehört nur in die App-Einstellungen im Browser.\n'
        );
        process.exit(2);
      }
    }
  }
  process.exit(0);
});
