/**
 * Motore di traduzione Italiano → PowerShell
 * Basato su regole di pattern matching e parole chiave.
 * Completamente offline, nessuna API esterna.
 */

// ─── Normalizzazione input ──────────────────────────────────────────
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\sàèéìòù.,;:!?*/\-\\"'()\[\]<>|&%$€£@#+=\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Estrazione parametri ───────────────────────────────────────────

/** Cerca una parola o frase esatta nell'input (con word boundaries) */
function hasWord(input, words) {
  const arr = Array.isArray(words) ? words : [words];
  return arr.some(w => {
    const regex = new RegExp('\\b' + w.replace(/\s+/g, '\\s+') + '\\b', 'i');
    return regex.test(input);
  });
}

/** Cerca una sottostringa (senza word boundaries, per match parziali come radici) */
function hasSubstring(input, words) {
  const arr = Array.isArray(words) ? words : [words];
  return arr.some(w => input.includes(w.toLowerCase()));
}

/** Estrae un valore dopo una chiave (es. "con nome X" → X) */
function extractAfter(input, keys) {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const key of arr) {
    const patterns = [
      new RegExp(key + '\\s+[\'"]?([^\'"\\s,;.]+)', 'i'),
      new RegExp(key + '\\s+[\'"]?([^\'"\\s,;.]+(?:\\s+[^\'"\\s,;.]+){0,3})', 'i'),
    ];
    for (const pat of patterns) {
      const m = input.match(pat);
      if (m) return m[1].replace(/['"]/g, '').trim();
    }
  }
  return null;
}

/** Estrae dimensione in formato X MB/GB/KB */
function extractSize(input) {
  const m = input.match(/(\d+(?:[.,]\d+)?)\s*(MB|GB|KB|TB|byte|bytes|megabyte|gigabyte|kilobyte|terabyte)/i);
  if (m) {
    const num = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toUpperCase().replace(/^BYTES?$/, 'B').replace(/^MEGABYTE$/i, 'MB')
      .replace(/^GIGABYTE$/i, 'GB').replace(/^KILOBYTE$/i, 'KB').replace(/^TERABYTE$/i, 'TB');
    return { num, unit };
  }
  return null;
}

/** Estrae un'estensione di file (richiede almeno 2 caratteri o estensione nota) */
function extractExtension(input) {
  // Cerca pattern come "file X" o "*.X" o "X" come parola isolata
  const m = input.match(/(?:file|documenti|elementi|con estensione|\*\.)\s*(pdf|txt|docx?|xlsx?|pptx?|jpg|jpeg|png|gif|bmp|svg|mp3|mp4|avi|mkv|zip|rar|7z|exe|dll|msi|bat|cmd|ps1|psm1|json|xml|csv|html?|css|js|ts|py|java|cpp|cs|go|rs|log|ini|cfg|conf|yaml|yml|toml|md|sql)\b/i);
  if (m) return m[1].toLowerCase();
  // Fallback: estensione come parola autonoma (evita lettere singole che potrebbero essere path)
  const m2 = input.match(/\b(pdf|txt|docx?|xlsx?|pptx?|jpg|jpeg|png|gif|bmp|svg|mp3|mp4|avi|mkv|zip|rar|7z|exe|dll|msi|bat|cmd|ps1|psm1|json|xml|csv|html?|css|js|ts|py|java|cpp|cs|go|rs|log|ini|cfg|conf|yaml|yml|toml|md|sql)\b/i);
  if (m2 && m2[1].length >= 3) return m2[1].toLowerCase();
  return null;
}

/** Estrae un numero (primo numero trovato) */
function extractNumber(input) {
  const m = input.match(/\b(\d+)\b/);
  return m ? parseInt(m[1], 10) : null;
}

/** Estrae un percorso/cartella */
function extractPath(input) {
  const patterns = [
    /(?:nella cartella|nella directory|nel percorso|in|sotto|dentro)\s+['"]?([^\s,;.]+(?:\\[^\s,;.]+)*)['"]?/i,
    /(?:cartella|directory|percorso)\s+['"]?([^\s,;.]+(?:\\[^\s,;.]+)*)['"]?/i,
  ];
  for (const pat of patterns) {
    const m = input.match(pat);
    if (m) return m[1].replace(/['"]/g, '').trim();
  }
  return null;
}

// ─── Regole di traduzione ───────────────────────────────────────────

/**
 * Ogni regola:
 * - keywords: array di frasi/parole chiave italiane (almeno una deve matchare)
 * - build: funzione(input, ctx) → stringa comando PowerShell
 * - priority: numero (più alto = controllato prima)
 */

const rules = [

  // ─── Get-ChildItem (elencare file/cartelle) ─────────────────────
  {
    keywords: ['elenca', 'mostra', 'visualizza', 'vedi', 'lista', 'listare'],
    nouns: ['file', 'cartell', 'directory', 'document', 'element'],
    priority: 10,
    build(input) {
      let cmd = 'Get-ChildItem';
      const params = [];

      const path = extractPath(input);
      if (path) params.push(`-Path '${path}'`);

      const ext = extractExtension(input);
      if (ext) {
        // Se c'è un'estensione, filtriamo
        params.push(`-Filter '*.${ext}'`);
      } else if (hasWord(input, ['tutti i file', 'ogni file', 'tutti'])) {
        // va bene così
      }

      if (hasWord(input, ['nascosti', 'nascosto', 'hidden'])) {
        params.push('-Force');
      }

      if (hasWord(input, ['ricorsivo', 'ricorsivamente', 'sottocartelle', 'sotto-cartelle', 'in profondità'])) {
        params.push('-Recurse');
      }

      if (hasWord(input, ['sola lettura', 'readonly', 'read-only'])) {
        params.push('-Attributes ReadOnly');
      }

      if (hasWord(input, ['sistema', 'di sistema'])) {
        params.push('-Attributes System');
      }

      // Filtro per dimensione
      const size = extractSize(input);
      if (size) {
        const sizeBytes = size.num * (size.unit === 'TB' ? 1e12 : size.unit === 'GB' ? 1e9 : size.unit === 'MB' ? 1e6 : size.unit === 'KB' ? 1e3 : 1);
        if (hasWord(input, ['più grandi', 'maggiori', 'superiori', 'oltre'])) {
          cmd += ` | Where-Object { $_.Length -gt ${sizeBytes} }`;
        } else if (hasWord(input, ['più piccoli', 'minori', 'inferiori', 'sotto'])) {
          cmd += ` | Where-Object { $_.Length -lt ${sizeBytes} }`;
        }
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Get-ChildItem con Where-Object per dimensione ────────────────
  {
    keywords: ['più grandi', 'più piccoli', 'maggiori di', 'minori di'],
    nouns: ['file', 'document', 'element'],
    priority: 9,
    build(input) {
      let cmd = 'Get-ChildItem';
      const params = [];

      const path = extractPath(input);
      if (path) params.push(`-Path '${path}'`);

      const ext = extractExtension(input);
      if (ext) params.push(`-Filter '*.${ext}'`);

      if (hasWord(input, ['nascosti', 'nascosto'])) params.push('-Force');
      if (hasWord(input, ['ricorsivo', 'ricorsivamente', 'sottocartelle'])) params.push('-Recurse');

      const size = extractSize(input);
      if (size) {
        const sizeBytes = size.num * (size.unit === 'TB' ? 1e12 : size.unit === 'GB' ? 1e9 : size.unit === 'MB' ? 1e6 : size.unit === 'KB' ? 1e3 : 1);
        if (hasWord(input, ['più grandi', 'maggiori', 'superiori', 'oltre'])) {
          cmd += ` | Where-Object { $_.Length -gt ${sizeBytes} }`;
        } else if (hasWord(input, ['più piccoli', 'minori', 'inferiori', 'sotto'])) {
          cmd += ` | Where-Object { $_.Length -lt ${sizeBytes} }`;
        }
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Get-Process (processi) ──────────────────────────────────────
  {
    keywords: ['processo', 'processi', 'process', 'programma', 'programmi', 'programm', 'applicazione', 'applicazioni', 'applicazion'],
    action: ['trova', 'cerca', 'elenca', 'mostra', 'visualizza', 'vedi', 'lista'],
    priority: 10,
    build(input) {
      let cmd = 'Get-Process';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'chiamati', 'di nome', 'con il nome']);
      if (name) {
        // Supporta wildcard: se l'utente scrive "chrome" diventa "*chrome*"
        const useWildcard = !hasWord(input, ['esatto', 'esattamente', 'preciso']);
        params.push(`-Name '${useWildcard ? '*' + name + '*' : name}'`);
      }

      const id = extractAfter(input, ['con id', 'id', 'pid', 'con pid']);
      if (id && /^\d+$/.test(id)) {
        params.push(`-Id ${id}`);
      }

      if (hasWord(input, ['con più', 'maggiore', 'più memoria', 'memoria'])) {
        cmd += ' | Sort-Object -Property WS -Descending';
      }

      if (hasWord(input, ['cpu', 'processore', 'più cpu'])) {
        cmd += ' | Sort-Object -Property CPU -Descending';
      }

      const num = extractNumber(input);
      if (num && hasWord(input, ['primi', 'top', 'prime'])) {
        cmd += ` | Select-Object -First ${num}`;
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Stop-Process ────────────────────────────────────────────────
  {
    keywords: ['ferma', 'termina', 'uccidi', 'chiudi', 'stoppa', 'ammazza', 'kill'],
    nouns: ['process', 'programm', 'applicazion'],
    priority: 10,
    build(input) {
      let cmd = 'Stop-Process';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'di nome', 'con il nome', 'il processo']);
      if (name) {
        const useWildcard = !hasWord(input, ['esatto', 'esattamente', 'preciso']);
        params.push(`-Name '${useWildcard ? '*' + name + '*' : name}'`);
      }

      const id = extractAfter(input, ['con id', 'id', 'pid', 'con pid']);
      if (id && /^\d+$/.test(id)) {
        params.push(`-Id ${id}`);
      }

      if (hasWord(input, ['forza', 'forzatamente', 'forzando', 'senza chiedere'])) {
        params.push('-Force');
      }

      // Se nessun parametro specifico, cerchiamo di capire il nome
      if (params.length === 0) {
        // Cerca un nome di programma conosciuto
        const knownProcesses = ['chrome', 'firefox', 'edge', 'notepad', 'excel', 'word', 'outlook', 'powershell', 'cmd', 'explorer', 'calc', 'code', 'spotify', 'teams', 'slack', 'zoom', 'discord'];
        for (const proc of knownProcesses) {
          if (input.includes(proc)) {
            params.push(`-Name '*${proc}*'`);
            break;
          }
        }
      }

      if (params.length) cmd += ' ' + params.join(' ');
      else cmd += ' -Name \'nome-processo\'  # Sostituisci con il nome del processo';
      return cmd;
    }
  },

  // ─── Get-Service ─────────────────────────────────────────────────
  {
    keywords: ['servizio', 'servizi', 'serviz', 'servic', 'service', 'services'],
    action: ['elenca', 'mostra', 'vedi', 'trova', 'cerca', 'visualizza', 'lista'],
    priority: 10,
    build(input) {
      let cmd = 'Get-Service';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'di nome']);
      if (name) params.push(`-Name '*${name}*'`);

      if (hasWord(input, ['attivi', 'in esecuzione', 'running', 'avviati'])) {
        cmd += ' | Where-Object { $_.Status -eq \'Running\' }';
      }
      if (hasWord(input, ['fermi', 'stoppati', 'arrestati', 'stopped'])) {
        cmd += ' | Where-Object { $_.Status -eq \'Stopped\' }';
      }
      if (hasWord(input, ['in pausa', 'paused', 'sospesi'])) {
        cmd += ' | Where-Object { $_.Status -eq \'Paused\' }';
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Start-Service ───────────────────────────────────────────────
  {
    keywords: ['avvia', 'fai partire', 'lancia', 'start'],
    nouns: ['serviz', 'servic'],
    priority: 10,
    build(input) {
      let cmd = 'Start-Service';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'il servizio', 'di nome']);
      if (name) params.push(`-Name '${name}'`);

      if (params.length) cmd += ' ' + params.join(' ');
      else cmd += " -Name 'nome-servizio'  # Sostituisci con il nome del servizio";
      return cmd;
    }
  },

  // ─── Stop-Service ────────────────────────────────────────────────
  {
    keywords: ['ferma', 'stoppa', 'arresta', 'blocca'],
    nouns: ['serviz', 'servic'],
    priority: 10,
    build(input) {
      let cmd = 'Stop-Service';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'il servizio', 'di nome']);
      if (name) params.push(`-Name '${name}'`);
      if (hasWord(input, ['forza', 'forzatamente'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      else cmd += " -Name 'nome-servizio'  # Sostituisci con il nome del servizio";
      return cmd;
    }
  },

  // ─── Restart-Service ─────────────────────────────────────────────
  {
    keywords: ['riavvia', 'restart', 'ricarica', 'reboot'],
    nouns: ['serviz', 'servic'],
    priority: 10,
    build(input) {
      let cmd = 'Restart-Service';
      const params = [];

      const name = extractAfter(input, ['con nome', 'chiamato', 'nome', 'il servizio', 'di nome']);
      if (name) params.push(`-Name '${name}'`);
      if (hasWord(input, ['forza', 'forzatamente'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      else cmd += " -Name 'nome-servizio'  # Sostituisci con il nome del servizio";
      return cmd;
    }
  },

  // ─── Copy-Item ───────────────────────────────────────────────────
  {
    keywords: ['copia', 'copiare', 'duplica'],
    nouns: ['file', 'cartell', 'directory', 'document', 'element'],
    priority: 10,
    build(input) {
      let cmd = 'Copy-Item';
      const params = [];

      // Estrai origine
      const ext = extractExtension(input);
      if (ext) params.push(`-Path '*.${ext}'`);
      else if (hasWord(input, ['tutti', 'tutti i file', 'ogni file'])) params.push('-Path \'*.*\'');
      else {
        const path = extractPath(input);
        if (path) params.push(`-Path '${path}'`);
        else params.push('-Path \'origine\'  # Specifica il percorso di origine');
      }

      // Destinazione (ordine: chiavi più specifiche prima)
      const destKeys = ['in una sottocartella', 'nella sottocartella', 'nella cartella', 'nella directory', 'sotto', 'destinazione in', 'destinazione', 'in', 'a'];
      let destination = null;
      for (const key of destKeys) {
        // Per "in una sottocartella X" / "nella sottocartella X" cerchiamo dopo "sottocartella"
        if (key === 'in una sottocartella' || key === 'nella sottocartella') {
          const m = input.match(/sottocartella\s+['"]?([^\s,;.]+)/i);
          if (m) { destination = m[1]; break; }
        }
        const val = extractAfter(input, [key]);
        if (val && !['origine', 'source', 'una', 'un'].includes(val.toLowerCase())) {
          destination = val;
          break;
        }
      }
      if (destination) {
        destination = destination.replace(/\.(\/|\\)/, '');
        params.push(`-Destination '.\\${destination}'`);
      } else {
        params.push("-Destination '.\\destinazione'  # Specifica la cartella di destinazione");
      }

      if (hasWord(input, ['ricorsivo', 'ricorsivamente', 'sottocartelle'])) params.push('-Recurse');
      if (hasWord(input, ['forza', 'forzatamente', 'sovrascrivi'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Move-Item ───────────────────────────────────────────────────
  {
    keywords: ['sposta', 'muovi', 'trasferisci'],
    nouns: ['file', 'cartell', 'directory', 'document', 'element'],
    priority: 10,
    build(input) {
      let cmd = 'Move-Item';
      const params = [];

      const ext = extractExtension(input);
      if (ext) params.push(`-Path '*.${ext}'`);
      else if (hasWord(input, ['tutti', 'tutti i file', 'ogni file'])) params.push('-Path \'*.*\'');
      else {
        const path = extractPath(input);
        if (path) params.push(`-Path '${path}'`);
        else params.push('-Path \'origine\'  # Specifica il percorso di origine');
      }

      // Destinazione (ordine: chiavi più specifiche prima)
      const destKeys = ['in una sottocartella', 'nella sottocartella', 'nella cartella', 'nella directory', 'sotto', 'destinazione in', 'destinazione', 'in', 'a'];
      let destination = null;
      for (const key of destKeys) {
        if (key === 'in una sottocartella' || key === 'nella sottocartella') {
          const m = input.match(/sottocartella\s+['"]?([^\s,;.]+)/i);
          if (m) { destination = m[1]; break; }
        }
        const val = extractAfter(input, [key]);
        if (val && !['origine', 'source', 'una', 'un'].includes(val.toLowerCase())) {
          destination = val;
          break;
        }
      }
      if (destination) {
        destination = destination.replace(/\.(\/|\\)/, '');
        params.push(`-Destination '.\\${destination}'`);
      } else {
        params.push("-Destination '.\\destinazione'  # Specifica la cartella di destinazione");
      }

      if (hasWord(input, ['forza', 'forzatamente', 'sovrascrivi'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Remove-Item ─────────────────────────────────────────────────
  {
    keywords: ['cancella', 'elimina', 'rimuovi', 'cancellare', 'eliminare', 'rimuovere', 'delete', 'remove'],
    nouns: ['file', 'cartell', 'directory', 'document', 'element'],
    priority: 10,
    build(input) {
      let cmd = 'Remove-Item';
      const params = [];

      const ext = extractExtension(input);
      if (ext) params.push(`-Path '*.${ext}'`);
      else if (hasWord(input, ['tutti', 'tutti i file', 'ogni file'])) params.push('-Path \'*.*\'');
      else {
        const path = extractPath(input);
        if (path) params.push(`-Path '${path}'`);
        else params.push('-Path \'nome-file\'  # Specifica il file da eliminare');
      }

      if (hasWord(input, ['ricorsivo', 'ricorsivamente', 'sottocartelle', 'contenuto'])) params.push('-Recurse');
      if (hasWord(input, ['forza', 'forzatamente', 'senza chiedere', 'senza conferma'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Rename-Item ─────────────────────────────────────────────────
  {
    keywords: ['rinomina', 'rinominare', 'cambia nome', 'rename'],
    nouns: ['file', 'cartell', 'directory', 'element'],
    priority: 10,
    build(input) {
      let cmd = 'Rename-Item';
      const params = [];

      // Vecchio nome
      let oldName = extractAfter(input, ['rinominare il file', 'il file', 'rinomina il file']);
      if (!oldName || oldName === 'in') {
        oldName = extractAfter(input, ['da', 'rinomina']);
      }
      if (oldName && !['a', 'in', 'come'].includes(oldName.toLowerCase()) && oldName.length > 1) {
        params.push(`-Path '${oldName}'`);
      } else {
        params.push('-Path \'vecchio-nome\'  # Nome attuale del file');
      }

      // Nuovo nome
      let newName = extractAfter(input, ['in', 'a', 'come', 'con il nome', 'con nome']);
      if (!newName || newName.length < 2) {
        newName = null;
      }
      if (newName) {
        params.push(`-NewName '${newName}'`);
      } else {
        params.push('-NewName \'nuovo-nome\'  # Nuovo nome del file');
      }

      if (hasWord(input, ['forza', 'forzatamente'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── New-Item ────────────────────────────────────────────────────
  {
    keywords: ['crea', 'creare', 'genera', 'nuovo'],
    nouns: ['file', 'cartell', 'directory', 'document'],
    priority: 10,
    build(input) {
      let cmd = 'New-Item';
      const params = [];

      const path = extractAfter(input, ['crea', 'in', 'nella cartella', 'chiamato', 'con nome', 'nome']);
      if (path && !['cartella', 'directory', 'file'].includes(path.toLowerCase())) {
        params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'nome-elemento'  # Percorso o nome del nuovo elemento");
      }

      if (hasWord(input, ['cartella', 'directory', 'folder'])) {
        params.push('-ItemType Directory');
      } else if (hasWord(input, ['file', 'documento'])) {
        params.push('-ItemType File');
      }

      if (hasWord(input, ['forza', 'forzatamente', 'sovrascrivi'])) params.push('-Force');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Get-Content ─────────────────────────────────────────────────
  {
    keywords: ['leggi', 'mostra contenuto', 'visualizza contenuto', 'apri', 'vedi dentro', 'contenuto di', 'righe', 'leggere', 'leggimi', 'prime righe', 'ultime righe', 'prime', 'ultime', 'riga', 'head', 'tail', 'testa del file', 'coda del file'],
    nouns: ['file', 'document'],
    priority: 10,
    build(input) {
      let cmd = 'Get-Content';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['file', 'il file', 'di']);
      if (path && !['testo', 'contenuto'].includes(path.toLowerCase())) {
        params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'nome-file.txt'  # Specifica il percorso del file");
      }

      const num = extractNumber(input);
      if (num && hasWord(input, ['prime', 'primi', 'testa', 'inizio', 'head'])) {
        params.push(`-TotalCount ${num}`);
      }
      if (num && hasWord(input, ['ultime', 'ultimi', 'coda', 'fine', 'tail'])) {
        params.push(`-Tail ${num}`);
      }

      if (hasWord(input, ['raw', 'grezzo', 'intero', 'tutto insieme'])) {
        params.push('-Raw');
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Set-Content ─────────────────────────────────────────────────
  {
    keywords: ['scrivi', 'scrivi contenuto', 'salva contenuto', 'sovrascrivi file', 'scrivi nel file', 'salva nel file', 'salva testo in'],
    nouns: ['contenuto', 'testo', 'file'],
    priority: 10,
    build(input) {
      let cmd = 'Set-Content';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['in', 'su', 'nel file', 'file']);
      if (path && !['testo', 'contenuto'].includes(path.toLowerCase())) {
        params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'nome-file.txt'  # Percorso del file");
      }

      const value = extractAfter(input, ['scrivi', 'salva', 'il testo', 'la stringa', 'con', 'valore']);
      if (value && value.length < 50) {
        params.push(`-Value '${value}'`);
      } else {
        params.push("-Value 'testo da scrivere'  # Il contenuto da salvare");
      }

      if (hasWord(input, ['encoding', 'utf8', 'utf-8'])) params.push('-Encoding UTF8');
      if (hasWord(input, ['ascii'])) params.push('-Encoding ASCII');
      if (hasWord(input, ['unicode'])) params.push('-Encoding Unicode');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Add-Content ─────────────────────────────────────────────────
  {
    keywords: ['aggiungi', 'accoda', 'appendi', 'aggiungere', 'aggiungi a file', 'aggiungi al file', 'aggiungi in coda', 'accoda a file'],
    nouns: ['contenuto', 'testo', 'riga', 'file'],
    priority: 12,
    build(input) {
      let cmd = 'Add-Content';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['in', 'a', 'al file', 'nel file', 'file']);
      if (path && !['testo', 'contenuto', 'riga'].includes(path.toLowerCase())) {
        params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'nome-file.txt'  # Percorso del file");
      }

      const value = extractAfter(input, ['aggiungi', 'accoda', 'il testo', 'la riga', 'la stringa', 'con', 'valore']);
      if (value && value.length < 50) {
        params.push(`-Value '${value}'`);
      } else {
        params.push("-Value 'testo da aggiungere'  # Il contenuto da accodare");
      }

      if (hasWord(input, ['encoding', 'utf8', 'utf-8'])) params.push('-Encoding UTF8');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Out-File ────────────────────────────────────────────────────
  {
    keywords: ['salva output su file', 'reindirizza output', 'scrivi output su file', 'output su file', 'pipe su file', 'manda output a file', 'reindirizza su file'],
    priority: 8,
    build(input) {
      let cmd = 'Out-File';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['su', 'in', 'file']);
      if (path && !['output', 'risultato'].includes(path.toLowerCase())) {
        params.push(`-FilePath '${path}'`);
      } else {
        params.push("-FilePath 'output.txt'  # Percorso del file di output");
      }

      if (hasWord(input, ['append', 'accoda', 'aggiungi'])) params.push('-Append');
      if (hasWord(input, ['forza', 'sovrascrivi'])) params.push('-Force');
      if (hasWord(input, ['no nuova linea', 'no newline', 'senza a capo'])) params.push('-NoNewline');

      if (params.length) cmd += ' ' + params.join(' ');
      return '# Prima genera l\'output con un altro comando, poi:\n' + cmd;
    }
  },

  // ─── Where-Object (filtro) ───────────────────────────────────────
  {
    keywords: ['filtra', 'filtrare', 'dove', 'in cui', 'che hanno', 'che sono', 'che contengono'],
    priority: 7,
    build(input) {
      let condition = '';

      if (hasWord(input, ['più grandi', 'maggiori'])) {
        const size = extractSize(input);
        if (size) {
          const sizeBytes = size.num * (size.unit === 'TB' ? 1e12 : size.unit === 'GB' ? 1e9 : size.unit === 'MB' ? 1e6 : size.unit === 'KB' ? 1e3 : 1);
          condition = `$_.Length -gt ${sizeBytes}`;
        } else {
          condition = '$_.Property -gt valore  # Specifica proprietà e valore';
        }
      } else if (hasWord(input, ['più piccoli', 'minori'])) {
        const size = extractSize(input);
        if (size) {
          const sizeBytes = size.num * (size.unit === 'TB' ? 1e12 : size.unit === 'GB' ? 1e9 : size.unit === 'MB' ? 1e6 : size.unit === 'KB' ? 1e3 : 1);
          condition = `$_.Length -lt ${sizeBytes}`;
        } else {
          condition = '$_.Property -lt valore  # Specifica proprietà e valore';
        }
      } else if (hasWord(input, ['uguale', 'pari a', 'esattamente'])) {
        const val = extractAfter(input, ['uguale a', 'pari a', 'esattamente']);
        condition = val ? `$_.Property -eq '${val}'` : "$_.Property -eq 'valore'";
      } else if (hasWord(input, ['contiene', 'contengono'])) {
        const val = extractAfter(input, ['contiene', 'contengono']);
        condition = val ? `$_.Property -like '*${val}*'` : "$_.Property -like '*valore*'";
      } else {
        condition = '$_ -condizione  # Definisci la condizione di filtro';
      }

      return `Where-Object { ${condition} }`;
    }
  },

  // ─── Select-Object ───────────────────────────────────────────────
  {
    keywords: ['seleziona', 'prendi', 'mostra solo', 'proprietà', 'colonne'],
    priority: 8,
    build(input) {
      let cmd = 'Select-Object';
      const params = [];

      const props = extractAfter(input, ['proprietà', 'colonne', 'campi', 'seleziona', 'prendi']);
      if (props) {
        const propList = props.split(/[\s,;]+e[\s,;]+|[\s,;]+/).filter(p => p.length > 0 && p !== 'e');
        params.push(`-Property ${propList.map(p => `'${p}'`).join(', ')}`);
      } else {
        params.push("-Property 'NomeProprietà1', 'NomeProprietà2'");
      }

      const num = extractNumber(input);
      if (num && hasWord(input, ['primi', 'prime', 'top', 'first'])) {
        params.push(`-First ${num}`);
      }
      if (num && hasWord(input, ['ultimi', 'ultime', 'last'])) {
        params.push(`-Last ${num}`);
      }
      if (hasWord(input, ['unici', 'distinti', 'senza duplicati'])) {
        params.push('-Unique');
      }
      if (hasWord(input, ['salta', 'skip', 'ignora primi'])) {
        params.push(num ? `-Skip ${num}` : '-Skip N');
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── ForEach-Object ──────────────────────────────────────────────
  {
    keywords: ['per ogni', 'per ciascuno', 'per ognuno', 'foreach', 'cicla', 'itera', 'esegui per', 'per ogni elemento'],
    priority: 9,
    build(input) {
      const action = extractAfter(input, ['per ogni', 'per ciascuno', 'esegui', 'fai']);
      const actionBlock = action
        ? `{ ${action.includes('$_') ? action : '$_ | ' + action} }`
        : '{ $_  # Operazione da eseguire su ogni elemento }';
      return `ForEach-Object ${actionBlock}`;
    }
  },

  // ─── Sort-Object ─────────────────────────────────────────────────
  {
    keywords: ['ordina', 'ordinare', 'metti in ordine'],
    priority: 8,
    build(input) {
      let cmd = 'Sort-Object';
      const params = [];

      const prop = extractAfter(input, ['per', 'in base a', 'secondo', 'proprietà']);
      if (prop) params.push(`-Property '${prop}'`);
      else params.push("-Property 'NomeProprietà'  # Specifica la proprietà");

      if (hasWord(input, ['decrescente', 'discendente', 'dal più grande', 'z-a', 'z a'])) {
        params.push('-Descending');
      }
      if (hasWord(input, ['unico', 'unici'])) params.push('-Unique');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Group-Object ────────────────────────────────────────────────
  {
    keywords: ['raggruppa', 'raggruppare', 'group', 'gruppi'],
    priority: 8,
    build(input) {
      let cmd = 'Group-Object';
      const params = [];

      const prop = extractAfter(input, ['per', 'in base a', 'secondo', 'proprietà', 'campo']);
      if (prop) params.push(`-Property '${prop}'`);
      else params.push("-Property 'NomeProprietà'  # Specifica la proprietà per raggruppare");

      if (hasWord(input, ['no element', 'senza elementi', 'solo conteggio'])) params.push('-NoElement');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Measure-Object ──────────────────────────────────────────────
  {
    keywords: ['misura', 'conta', 'contare', 'statistiche', 'calcola', 'totale', 'media', 'somma', 'quanti sono', 'numero di'],
    priority: 11,
    build(input) {
      let cmd = 'Measure-Object';
      const params = [];

      if (hasWord(input, ['somma', 'totale', 'sum'])) params.push('-Sum');
      if (hasWord(input, ['media', 'average'])) params.push('-Average');
      if (hasWord(input, ['massimo', 'max', 'minimo', 'min'])) {
        params.push('-Maximum');
        params.push('-Minimum');
      }

      const prop = extractAfter(input, ['property', 'proprietà', 'di']);
      if (prop && !['file', 'elementi', 'righe', 'oggetti'].includes(prop.toLowerCase())) {
        params.push(`-Property '${prop}'`);
      }

      if (params.length === 0) params.push('-Property Length -Sum -Average');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Export-Csv ──────────────────────────────────────────────────
  {
    keywords: ['esporta', 'esportare', 'salva come csv', 'export'],
    nouns: ['csv', 'excel', 'foglio'],
    priority: 10,
    build(input) {
      let cmd = 'Export-Csv';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['in', 'su', 'come', 'file', 'nome file']);
      if (path && !['csv', 'excel'].includes(path.toLowerCase())) {
        if (!path.endsWith('.csv')) params.push(`-Path '${path}.csv'`);
        else params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'output.csv'  # Percorso del file CSV");
      }

      if (hasWord(input, ['senza header', 'no intestazione', 'no header'])) params.push('-NoTypeInformation');
      else params.push('-NoTypeInformation');
      if (hasWord(input, ['append', 'accoda'])) params.push('-Append');
      if (hasWord(input, ['delimiter', 'separatore', 'punto e virgola', ';'])) params.push('-Delimiter \';\'');
      if (hasWord(input, ['utf8', 'utf-8'])) params.push('-Encoding UTF8');

      if (params.length) cmd += ' ' + params.join(' ');
      return '# Prima genera i dati con un altro comando, poi:\n' + cmd;
    }
  },

  // ─── Import-Csv ──────────────────────────────────────────────────
  {
    keywords: ['importa', 'importare', 'leggi csv', 'carica csv', 'import'],
    nouns: ['csv', 'excel'],
    priority: 10,
    build(input) {
      let cmd = 'Import-Csv';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['da', 'file', 'il file']);
      if (path && !['csv'].includes(path.toLowerCase())) {
        params.push(`-Path '${path}'`);
      } else {
        params.push("-Path 'dati.csv'  # Percorso del file CSV");
      }

      if (hasWord(input, ['delimiter', 'separatore', 'punto e virgola', ';'])) params.push('-Delimiter \';\'');
      if (hasWord(input, ['header', 'intestazione', 'colonne'])) {
        const headers = extractAfter(input, ['header', 'intestazione', 'colonne']);
        if (headers) {
          const hList = headers.split(/[\s,;]+/).filter(h => h.length > 0 && h !== 'e');
          params.push(`-Header ${hList.map(h => `'${h}'`).join(', ')}`);
        }
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── ConvertTo-Json ──────────────────────────────────────────────
  {
    keywords: ['converti in json', 'to json', 'converti a json', 'trasforma in json', 'in formato json', 'serializza in json'],
    priority: 9,
    build(input) {
      let cmd = 'ConvertTo-Json';
      const params = [];

      if (hasWord(input, ['compatto', 'compress', 'senza spazi'])) params.push('-Compress');
      const depth = extractNumber(input);
      if (depth && hasWord(input, ['profondità', 'depth'])) params.push(`-Depth ${depth}`);
      else params.push('-Depth 3');

      if (params.length) cmd += ' ' + params.join(' ');
      return '# Applica a un comando precedente:\n' + cmd;
    }
  },

  // ─── ConvertFrom-Json ────────────────────────────────────────────
  {
    keywords: ['converti da json', 'from json', 'leggi json', 'parsa json', 'decodifica json', 'interpreta json', 'da formato json'],
    priority: 9,
    build(input) {
      return 'ConvertFrom-Json';
    }
  },

  // ─── Get-EventLog ────────────────────────────────────────────────
  {
    keywords: ['log', 'eventi', 'event log', 'registro eventi'],
    action: ['elenca', 'mostra', 'vedi', 'trova', 'cerca', 'visualizza'],
    priority: 10,
    build(input) {
      let cmd = 'Get-EventLog';
      const params = [];

      const logTypes = { system: 'System', sistema: 'System', application: 'Application', applicazione: 'Application', security: 'Security', sicurezza: 'Security' };
      let logName = 'System';
      for (const [key, val] of Object.entries(logTypes)) {
        if (input.includes(key)) { logName = val; break; }
      }
      params.push(`-LogName '${logName}'`);

      const num = extractNumber(input);
      if (num && hasWord(input, ['ultimi', 'recenti', 'più recenti'])) {
        params.push(`-Newest ${num}`);
      } else if (num) {
        params.push(`-Newest ${num}`);
      }

      if (hasWord(input, ['errore', 'errori', 'error'])) {
        cmd += ` | Where-Object { $_.EntryType -eq 'Error' }`;
      }
      if (hasWord(input, ['warning', 'avvisi', 'avvertimenti'])) {
        cmd += ` | Where-Object { $_.EntryType -eq 'Warning' }`;
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Clear-EventLog ──────────────────────────────────────────────
  {
    keywords: ['pulisci', 'svuota', 'cancella', 'clear'],
    nouns: ['log', 'eventi', 'registro'],
    priority: 10,
    build(input) {
      let cmd = 'Clear-EventLog';
      const params = [];

      const logTypes = { system: 'System', sistema: 'System', application: 'Application', applicazione: 'Application', security: 'Security', sicurezza: 'Security' };
      let logName = 'System';
      for (const [key, val] of Object.entries(logTypes)) {
        if (input.includes(key)) { logName = val; break; }
      }
      params.push(`-LogName '${logName}'`);

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Get-WmiObject ───────────────────────────────────────────────
  {
    keywords: ['wmi', 'informazioni sistema', 'info sistema', 'hardware', 'bios', 'scheda madre', 'informazioni sul', 'informazioni hardware', 'specifiche', 'configurazione sistema', 'informazioni processore', 'info cpu', 'scheda video', 'scheda di rete'],
    priority: 12,
    build(input) {
      let cmd = 'Get-WmiObject';
      const params = [];

      if (hasWord(input, ['bios'])) params.push('-Class Win32_BIOS');
      else if (hasWord(input, ['processore', 'cpu', 'processori'])) params.push('-Class Win32_Processor');
      else if (hasWord(input, ['memoria', 'ram', 'banchi'])) params.push('-Class Win32_PhysicalMemory');
      else if (hasWord(input, ['disco', 'hard disk', 'drive'])) params.push('-Class Win32_LogicalDisk');
      else if (hasWord(input, ['scheda video', 'video', 'gpu'])) params.push('-Class Win32_VideoController');
      else if (hasWord(input, ['scheda di rete', 'rete', 'network'])) params.push('-Class Win32_NetworkAdapter');
      else if (hasWord(input, ['sistema operativo', 'os', 'so'])) params.push('-Class Win32_OperatingSystem');
      else if (hasWord(input, ['servizi', 'services'])) params.push('-Class Win32_Service');
      else if (hasWord(input, ['processi', 'processes'])) params.push('-Class Win32_Process');
      else params.push('-Class Win32_ComputerSystem');

      if (hasWord(input, ['filtra', 'dove'])) {
        const filter = extractAfter(input, ['filtra', 'dove', 'con']);
        if (filter) params.push(`-Filter "${filter}"`);
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Invoke-Command ──────────────────────────────────────────────
  {
    keywords: ['remoto', 'remotamente', 'computer remoto', 'su un altro', 'remoting'],
    priority: 9,
    build(input) {
      let cmd = 'Invoke-Command';
      const params = [];

      const computer = extractAfter(input, ['computer', 'remoto', 'su', 'macchina', 'server', 'remotamente su']);
      if (computer && !['remoto', 'remotamente'].includes(computer.toLowerCase())) {
        params.push(`-ComputerName '${computer}'`);
      } else {
        params.push("-ComputerName 'NOME-COMPUTER'  # Nome del computer remoto");
      }

      const scriptBlock = extractAfter(input, ['esegui', 'comando', 'script', 'eseguire']);
      if (scriptBlock && scriptBlock.length < 100) {
        params.push(`-ScriptBlock { ${scriptBlock} }`);
      } else {
        params.push('-ScriptBlock { Get-Process }  # Comando da eseguire sul computer remoto');
      }

      if (hasWord(input, ['credenziali', 'credenziali diverse', 'utente'])) {
        params.push('-Credential (Get-Credential)');
      }

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Tee-Object ──────────────────────────────────────────────────
  {
    keywords: ['tee', 'salva e mostra', 'mostra e salva', 'duplica output', 'salva mentre vedi', 'mostra mentre salvi', 'contemporaneamente su file'],
    priority: 15,
    build(input) {
      let cmd = 'Tee-Object';
      const params = [];

      const path = extractPath(input) || extractAfter(input, ['in', 'su', 'file']);
      if (path && !['output', 'schermo', 'terminale'].includes(path.toLowerCase())) {
        params.push(`-FilePath '${path}'`);
      } else {
        params.push("-FilePath 'output.txt'  # File dove salvare l'output");
      }

      if (hasWord(input, ['append', 'accoda'])) params.push('-Append');

      if (params.length) cmd += ' ' + params.join(' ');
      return '# Inserisci Tee-Object in una pipeline:\n' + cmd;
    }
  },

  // ─── Get-Help (comando speciale per aiuto) ───────────────────────
  {
    keywords: ['aiuto su', 'help su', 'manuale di', 'documentazione di', 'spiegazione di', 'info su', 'come si usa', 'aiuto', 'help', 'manuale', 'documentazione', 'spiegazione', 'guida di', 'guida su', 'guida', 'man'],
    priority: 12,
    build(input) {
      let cmd = 'Get-Help';
      const cmdName = extractAfter(input, ['aiuto su', 'help su', 'manuale di', 'documentazione di', 'info su', 'spiegazione di']);
      if (cmdName && cmdName.length < 40) {
        return `Get-Help ${cmdName} -Detailed`;
      }
      return 'Get-Help nome-comando -Detailed  # Sostituisci con il nome del comando';
    }
  },

  // ─── Get-Date ────────────────────────────────────────────────────
  {
    keywords: ['data', 'ora', 'data e ora', 'oggi', 'adesso', 'orario'],
    priority: 7,
    build(input) {
      let cmd = 'Get-Date';
      const params = [];

      if (hasWord(input, ['formato', 'format'])) {
        const fmt = extractAfter(input, ['formato', 'format']);
        if (fmt) params.push(`-Format '${fmt}'`);
        else params.push('-Format \'yyyy-MM-dd HH:mm:ss\'');
      }

      if (hasWord(input, ['solo data', 'senza ora'])) params.push('-Format \'yyyy-MM-dd\'');
      if (hasWord(input, ['solo ora', 'senza data'])) params.push('-Format \'HH:mm:ss\'');

      if (params.length) cmd += ' ' + params.join(' ');
      return cmd;
    }
  },

  // ─── Test-Path ───────────────────────────────────────────────────
  {
    keywords: ['esiste', 'verifica', 'controlla se'],
    nouns: ['file', 'cartell', 'directory', 'percorso'],
    priority: 7,
    build(input) {
      const path = extractPath(input) || extractAfter(input, ['file', 'cartella', 'directory', 'percorso', 'esiste']);
      if (path) {
        return `Test-Path '${path}'`;
      }
      return "Test-Path 'percorso-da-verificare'  # Restituisce True o False";
    }
  },

  // ─── Get-Location / Set-Location ─────────────────────────────────
  {
    keywords: ['dove sono', 'cartella corrente', 'posizione corrente', 'directory corrente', 'pwd', 'dove mi trovo', 'in che cartella', 'percorso corrente', 'qual è la cartella', 'vai a', 'spostati', 'cambia directory', 'cd', 'entra in', 'naviga in', 'posizionati in'],
    nouns: ['cartell', 'directory', 'percorso'],
    priority: 9,
    build(input) {
      if (hasWord(input, ['vai a', 'spostati', 'cambia directory', 'cd', 'entra in', 'naviga in', 'posizionati in'])) {
        const path = extractAfter(input, ['vai a', 'spostati in', 'cambia directory in', 'entra in', 'cd', 'naviga in', 'posizionati in']);
        if (path) return `Set-Location '${path}'`;
        return "Set-Location 'percorso'  # Cambia la directory corrente";
      }
      return 'Get-Location';
    }
  },

];

// ─── Funzione principale di traduzione ──────────────────────────────

function translate(italianText) {
  const input = normalize(italianText);

  if (!input || input.length < 2) {
    return {
      command: '',
      explanation: 'Inserisci una descrizione più dettagliata di cosa vuoi fare.',
      confidence: 0
    };
  }

  // Ordina regole per priorità
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  let bestMatch = null;
  let bestScore = 0;

  for (const rule of sorted) {
    let score = 0;
    let kwMatch = 0, nounMatch = 0, actionMatch = 0;

    // Match keywords (più peso: una keyword deve battere qualsiasi match di soli nomi)
    for (const kw of rule.keywords) {
      if (hasWord(input, kw)) {
        kwMatch++;
        score += rule.priority * 2;
      }
    }

    // Match nouns (peso ridotto: servono a differenziare regole con stesse keyword)
    if (rule.nouns) {
      for (const noun of rule.nouns) {
        if (hasSubstring(input, noun)) {
          nounMatch++;
          score += 4;
        }
      }
    }

    // Match actions (peso ridotto)
    if (rule.action) {
      for (const act of rule.action) {
        if (hasSubstring(input, act)) {
          actionMatch++;
          score += 3;
        }
      }
    }

    // Se non ci sono keyword match ma ci sono sia noun che action match, assegna punteggio base
    if (kwMatch === 0 && nounMatch > 0 && actionMatch > 0) {
      score += rule.priority;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (bestMatch && bestScore > 0) {
    const command = bestMatch.build(input);
    const confidence = Math.min(100, Math.round((bestScore / (bestMatch.priority + 8)) * 100));
    return {
      command,
      explanation: generateExplanation(command, input),
      confidence
    };
  }

  // Fallback: cerca parole chiave semplici
  const fallback = generateFallback(input);
  return {
    command: fallback.command,
    explanation: fallback.explanation,
    confidence: fallback.confidence
  };
}

function generateExplanation(command, input) {
  if (command.includes('Get-ChildItem')) return 'Elenca file e cartelle nella directory specificata. Usa -Recurse per includere le sottocartelle.';
  if (command.includes('Get-Process')) return 'Mostra i processi in esecuzione. Puoi filtrare per nome o ID.';
  if (command.includes('Stop-Process')) return 'Termina uno o più processi. Usa con cautela!';
  if (command.includes('Get-Service')) return 'Elenca i servizi di sistema e il loro stato.';
  if (command.includes('Start-Service')) return 'Avvia un servizio di sistema. Richiede privilegi di amministratore per molti servizi.';
  if (command.includes('Stop-Service')) return 'Arresta un servizio di sistema. Richiede privilegi di amministratore.';
  if (command.includes('Restart-Service')) return 'Riavvia un servizio di sistema.';
  if (command.includes('Copy-Item')) return 'Copia file o cartelle da una posizione a un\'altra.';
  if (command.includes('Move-Item')) return 'Sposta file o cartelle da una posizione a un\'altra.';
  if (command.includes('Remove-Item')) return 'Elimina file o cartelle. Attenzione: l\'operazione è irreversibile!';
  if (command.includes('Rename-Item')) return 'Rinomina un file o una cartella.';
  if (command.includes('New-Item')) return 'Crea un nuovo file o una nuova cartella.';
  if (command.includes('Get-Content')) return 'Legge e mostra il contenuto di un file di testo.';
  if (command.includes('Set-Content')) return 'Scrive o sovrascrive il contenuto di un file.';
  if (command.includes('Add-Content')) return 'Aggiunge contenuto in coda a un file esistente.';
  if (command.includes('Where-Object')) return 'Filtra gli oggetti in base a una condizione.';
  if (command.includes('Select-Object')) return 'Seleziona proprietà specifiche o un numero limitato di oggetti.';
  if (command.includes('ForEach-Object')) return 'Esegue un\'operazione su ogni oggetto nella pipeline.';
  if (command.includes('Sort-Object')) return 'Ordina gli oggetti in base a una o più proprietà.';
  if (command.includes('Group-Object')) return 'Raggruppa gli oggetti in base a una proprietà comune.';
  if (command.includes('Measure-Object')) return 'Calcola statistiche (conteggio, somma, media) sugli oggetti.';
  if (command.includes('Export-Csv')) return 'Esporta dati in formato CSV. Aggiungi -NoTypeInformation per file puliti.';
  if (command.includes('Import-Csv')) return 'Importa dati da un file CSV.';
  if (command.includes('ConvertTo-Json')) return 'Converte oggetti in formato JSON.';
  if (command.includes('ConvertFrom-Json')) return 'Converte una stringa JSON in oggetti PowerShell.';
  if (command.includes('Get-EventLog')) return 'Legge gli eventi dal registro di sistema.';
  if (command.includes('Clear-EventLog')) return 'Pulisce un registro eventi. Richiede privilegi di amministratore.';
  if (command.includes('Get-WmiObject')) return 'Recupera informazioni di sistema via WMI.';
  if (command.includes('Invoke-Command')) return 'Esegue comandi su computer remoti via PowerShell Remoting.';
  if (command.includes('Tee-Object')) return 'Salva l\'output in un file mentre lo mostra anche a schermo.';
  if (command.includes('Out-File')) return 'Invia l\'output verso un file.';
  if (command.includes('Get-Help')) return 'Mostra la guida dettagliata di un comando PowerShell.';
  if (command.includes('Get-Date')) return 'Restituisce la data e/o l\'ora corrente.';
  if (command.includes('Test-Path')) return 'Verifica se un percorso (file o cartella) esiste.';
  if (command.includes('Get-Location')) return 'Mostra la directory corrente.';
  if (command.includes('Set-Location')) return 'Cambia la directory corrente.';

  return 'Comando PowerShell generato in base alla tua descrizione. Verifica i parametri prima di eseguirlo.';
}

function generateFallback(input) {
  // Cerca singole parole chiave di cmdlet
  const keywordMap = [
    { words: ['elenca', 'lista', 'mostra file', 'vedi file', 'visualizza file'], cmd: 'Get-ChildItem', expl: 'Elenca file e cartelle.' },
    { words: ['processi', 'processo'], cmd: 'Get-Process', expl: 'Mostra i processi in esecuzione.' },
    { words: ['copia'], cmd: "Copy-Item -Path 'origine' -Destination 'destinazione'", expl: 'Copia file da origine a destinazione.' },
    { words: ['sposta'], cmd: "Move-Item -Path 'origine' -Destination 'destinazione'", expl: 'Sposta file da origine a destinazione.' },
    { words: ['cancella', 'elimina', 'rimuovi'], cmd: "Remove-Item -Path 'file-da-eliminare'", expl: 'Elimina il file specificato.' },
    { words: ['rinomina'], cmd: "Rename-Item -Path 'vecchio-nome' -NewName 'nuovo-nome'", expl: 'Rinomina un file.' },
    { words: ['crea cartella', 'nuova cartella', 'nuova directory'], cmd: "New-Item -Path 'nome-cartella' -ItemType Directory", expl: 'Crea una nuova cartella.' },
    { words: ['crea file', 'nuovo file'], cmd: "New-Item -Path 'nome-file.txt' -ItemType File", expl: 'Crea un nuovo file.' },
    { words: ['leggi file', 'contenuto file', 'apri file'], cmd: "Get-Content -Path 'file.txt'", expl: 'Legge il contenuto di un file.' },
    { words: ['servizi'], cmd: 'Get-Service', expl: 'Elenca tutti i servizi.' },
    { words: ['csv'], cmd: "Import-Csv -Path 'file.csv'", expl: 'Importa dati da CSV.' },
    { words: ['json'], cmd: 'ConvertTo-Json', expl: 'Converte in formato JSON.' },
    { words: ['help', 'aiuto', 'manuale'], cmd: 'Get-Help nome-comando', expl: 'Mostra la guida di un comando.' },
    { words: ['data', 'ora'], cmd: 'Get-Date', expl: 'Mostra data e ora correnti.' },
    { words: ['dove sono', 'posizione', 'pwd'], cmd: 'Get-Location', expl: 'Mostra la directory corrente.' },
  ];

  for (const item of keywordMap) {
    for (const word of item.words) {
      if (hasWord(input, word)) {
        return {
          command: item.cmd,
          explanation: item.expl + ' Affina la descrizione per un comando più preciso.',
          confidence: 30
        };
      }
    }
  }

  return {
    command: '# Non riesco a interpretare la richiesta.\n# Prova a descrivere l\'operazione in modo più specifico.\n# Esempi:\n#   "elenca tutti i file nella cartella corrente"\n#   "trova i processi con nome chrome"\n#   "copia tutti i file txt in una sottocartella backup"',
    explanation: 'Descrivi cosa vuoi fare con parole chiave come "elenca", "copia", "trova", "cancella", "crea" seguite dal tipo di elemento (file, processi, servizi...).',
    confidence: 0
  };
}

module.exports = { translate };
