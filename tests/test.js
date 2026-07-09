/**
 * Test suite per il motore di traduzione PowerShellino
 * Verifica i criteri di accettazione e i pattern principali.
 */

const { translate } = require('../translator');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, description, expectedContains, expectedNotContains) {
  const result = translate(description);
  const cmd = result.command;

  let ok = true;
  const reasons = [];

  if (expectedContains) {
    for (const exp of expectedContains) {
      if (!cmd.includes(exp)) {
        ok = false;
        reasons.push(`Manca "${exp}"`);
      }
    }
  }

  if (expectedNotContains) {
    for (const nexp of expectedNotContains) {
      if (cmd.includes(nexp)) {
        ok = false;
        reasons.push(`Contiene "${nexp}" (non dovrebbe)`);
      }
    }
  }

  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
    console.log(`    In:  "${description}"`);
    console.log(`    Out: ${cmd}`);
  } else {
    failed++;
    failures.push({ name, description, cmd, reasons });
    console.log(`  ✗ ${name}`);
    console.log(`    In:  "${description}"`);
    console.log(`    Out: ${cmd}`);
    console.log(`    Motivi: ${reasons.join(', ')}`);
  }
}

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   PowerShellino — Test Suite             ║');
console.log('╚══════════════════════════════════════════╝\n');

// ─── Criteri di accettazione ──────────────────────────────────────
console.log('CRITERI DI ACCETTAZIONE:');
test(
  'Elenca file nella cartella',
  'elenca tutti i file nella cartella',
  ['Get-ChildItem'],
  []
);

test(
  'Trova processi chrome',
  'trova i processi con nome chrome',
  ['Get-Process', 'chrome'],
  []
);

test(
  'Copia txt in backup',
  'copia tutti i file txt in una sottocartella backup',
  ['Copy-Item', '*.txt', 'backup'],
  []
);

// ─── Get-ChildItem ────────────────────────────────────────────────
console.log('\nGet-ChildItem:');
test('Elenca file', 'elenca tutti i file', ['Get-ChildItem'], []);
test('Mostra file pdf', 'mostra tutti i file pdf', ['Get-ChildItem', '*.pdf'], []);
test('Elenca ricorsivo', 'elenca tutti i file ricorsivamente', ['Get-ChildItem', '-Recurse'], []);
test('File nascosti', 'elenca anche i file nascosti', ['Get-ChildItem', '-Force'], []);
test('File con dimensione', 'elenca file più grandi di 10 MB', ['Get-ChildItem', 'Where-Object', 'Length'], []);
test('File in percorso', 'elenca file nella cartella C:\\documenti', ['Get-ChildItem', 'documenti'], []);

// ─── Get-Process ──────────────────────────────────────────────────
console.log('\nGet-Process:');
test('Elenca processi', 'elenca tutti i processi', ['Get-Process'], []);
test('Processi chrome', 'trova i processi con nome firefox', ['Get-Process', 'firefox'], []);
test('Top processi', 'mostra i primi 10 processi per CPU', ['Get-Process'], []);

// ─── Stop-Process ─────────────────────────────────────────────────
console.log('\nStop-Process:');
test('Ferma processo', 'ferma il processo chiamato notepad', ['Stop-Process', 'notepad'], []);
test('Termina forzatamente', 'termina forzatamente il processo chrome', ['Stop-Process', 'Force'], []);

// ─── Copy-Item ────────────────────────────────────────────────────
console.log('\nCopy-Item:');
test('Copia file', 'copia tutti i file pdf in backup', ['Copy-Item', '*.pdf'], []);
test('Copia ricorsivo', 'copia tutti i file ricorsivamente nella cartella destinazione', ['Copy-Item', '-Recurse'], []);

// ─── Move-Item ────────────────────────────────────────────────────
console.log('\nMove-Item:');
test('Sposta file', 'sposta tutti i file txt in archivio', ['Move-Item', '*.txt'], []);

// ─── Remove-Item ──────────────────────────────────────────────────
console.log('\nRemove-Item:');
test('Elimina file', 'cancella tutti i file log', ['Remove-Item', '*.log'], []);
test('Rimuovi ricorsivo', 'rimuovi tutti i file nella cartella temp ricorsivamente', ['Remove-Item', '-Recurse'], []);

// ─── Rename-Item ──────────────────────────────────────────────────
console.log('\nRename-Item:');
test('Rinomina file', 'rinomina il file vecchio.txt in nuovo.txt', ['Rename-Item'], []);

// ─── New-Item ─────────────────────────────────────────────────────
console.log('\nNew-Item:');
test('Crea cartella', 'crea una nuova cartella chiamata progetti', ['New-Item', 'Directory'], []);
test('Crea file', 'crea un nuovo file chiamato readme.txt', ['New-Item', 'File'], []);

// ─── Get-Content ──────────────────────────────────────────────────
console.log('\nGet-Content:');
test('Leggi file', 'leggi il contenuto del file config.ini', ['Get-Content'], []);
test('Prime righe', 'mostra le prime 10 righe del file log.txt', ['Get-Content', 'TotalCount', '10'], []);

// ─── Set-Content / Add-Content ────────────────────────────────────
console.log('\nContent Operations:');
test('Scrivi su file', 'scrivi ciao mondo nel file output.txt', ['Set-Content'], []);
test('Aggiungi al file', 'aggiungi una nuova riga al file log.txt', ['Add-Content'], []);

// ─── Service ──────────────────────────────────────────────────────
console.log('\nService Management:');
test('Elenca servizi', 'elenca tutti i servizi', ['Get-Service'], []);
test('Servizi attivi', 'elenca tutti i servizi in esecuzione', ['Get-Service', 'Running'], []);
test('Avvia servizio', 'avvia il servizio chiamato spooler', ['Start-Service'], []);
test('Ferma servizio', 'ferma il servizio chiamato wuauserv', ['Stop-Service'], []);
test('Riavvia servizio', 'riavvia il servizio chiamato bits', ['Restart-Service'], []);

// ─── Filter & Select ──────────────────────────────────────────────
console.log('\nFilter & Select:');
test('Where-Object', 'filtra i file più grandi di 100 MB', ['Where-Object', 'Length'], []);
test('Select-Object', 'seleziona proprietà nome e dimensione', ['Select-Object', 'Property'], []);
test('Sort-Object', 'ordina per nome decrescente', ['Sort-Object', 'Descending'], []);
test('Group-Object', 'raggruppa per estensione', ['Group-Object'], []);
test('ForEach-Object', 'per ogni file esegui', ['ForEach-Object'], []);

// ─── Measure ──────────────────────────────────────────────────────
console.log('\nMeasure:');
test('Measure-Object', 'conta tutti i file nella cartella', ['Measure-Object'], []);

// ─── Export/Import ────────────────────────────────────────────────
console.log('\nExport/Import:');
test('Export-Csv', 'esporta i dati in csv', ['Export-Csv'], []);
test('Import-Csv', 'importa il file dati.csv', ['Import-Csv'], []);
test('ConvertTo-Json', 'converti in json', ['ConvertTo-Json'], []);
test('ConvertFrom-Json', 'converti da json', ['ConvertFrom-Json'], []);

// ─── System ───────────────────────────────────────────────────────
console.log('\nSystem Info:');
test('Get-WmiObject', 'mostra informazioni sul processore', ['Get-WmiObject'], []);
test('Get-EventLog', 'elenca gli ultimi 10 eventi di sistema', ['Get-EventLog'], []);

// ─── Remote ───────────────────────────────────────────────────────
console.log('\nRemote:');
test('Invoke-Command', 'esegui remotamente su server01', ['Invoke-Command'], []);

// ─── Other ────────────────────────────────────────────────────────
console.log('\nAltri comandi:');
test('Get-Date', 'mostra la data di oggi', ['Get-Date'], []);
test('Test-Path', 'verifica se esiste il file config.json', ['Test-Path'], []);
test('Get-Location', 'in che cartella mi trovo', ['Get-Location'], []);
test('Set-Location', 'spostati nella cartella documenti', ['Set-Location'], []);
test('Get-Help', 'mostra la guida di Get-Process', ['Get-Help'], []);
test('Out-File', 'salva output su file risultato.txt', ['Out-File'], []);
test('Tee-Object', 'mostra e salva su file', ['Tee-Object'], []);

// ─── Caso vuoto ───────────────────────────────────────────────────
console.log('\nCasi limite:');
test('Input vuoto', '', [], []); // Should not crash
test('Input brevissimo', 'a', [], []); // Should not crash

// ─── Riepilogo ────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  PASSATI: ${passed}`);
console.log(`  FALLITI: ${failed}`);
console.log('══════════════════════════════════════════════\n');

if (failures.length > 0) {
  console.log('DETTAGLIO FALLIMENTI:');
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. "${f.name}"`);
    console.log(`     Input: "${f.description}"`);
    console.log(`     Output: ${f.cmd}`);
    console.log(`     Motivi: ${f.reasons.join(', ')}`);
  });
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
