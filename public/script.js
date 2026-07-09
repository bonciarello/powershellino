/**
 * PowerShellino — Frontend logic
 * Handles input, API calls, output display, and copy functionality.
 */
(function () {
  'use strict';

  // ─── DOM References ──────────────────────────────────────────────
  const descriptionInput = document.getElementById('description-input');
  const generateBtn = document.getElementById('generate-btn');
  const charCount = document.getElementById('char-count');
  const outputSection = document.getElementById('output-section');
  const commandOutput = document.getElementById('command-output');
  const explanationText = document.getElementById('explanation-text');
  const errorMessage = document.getElementById('error-message');
  const copyBtn = document.getElementById('copy-btn');
  const copyText = copyBtn.querySelector('.copy-text');
  const confidenceBadge = document.getElementById('confidence-badge');
  const exampleChips = document.querySelectorAll('.chip');

  let currentCommand = '';

  // ─── Character Counter ──────────────────────────────────────────
  descriptionInput.addEventListener('input', function () {
    const len = this.value.length;
    charCount.textContent = len + ' / 500';

    // Enable/disable generate button
    generateBtn.disabled = len < 2;
  });

  // ─── Example Chips ──────────────────────────────────────────────
  exampleChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      const example = this.getAttribute('data-example');
      descriptionInput.value = example;
      descriptionInput.dispatchEvent(new Event('input'));
      descriptionInput.focus();
      // Auto-generate on chip click
      generateCommand();
    });
  });

  // ─── Generate Command ───────────────────────────────────────────
  generateBtn.addEventListener('click', generateCommand);

  // Allow Ctrl+Enter / Cmd+Enter to generate
  descriptionInput.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateCommand();
    }
  });

  async function generateCommand() {
    const description = descriptionInput.value.trim();

    if (description.length < 2) {
      showError('Inserisci almeno 2 caratteri per descrivere cosa vuoi fare.');
      return;
    }

    // UI state: loading
    setLoading(true);
    hideError();

    try {
      const response = await fetch('api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description })
      });

      if (!response.ok) {
        throw new Error('Errore del server: ' + response.status);
      }

      const data = await response.json();

      if (data.error) {
        showError(data.error);
        updateOutput('', '', 0);
      } else {
        currentCommand = data.command;
        updateOutput(data.command, data.explanation, data.confidence);
        hideError();
      }
    } catch (err) {
      showError('Impossibile contattare il server. Riprova tra qualche secondo.');
      console.error('Generate error:', err);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    if (isLoading) {
      generateBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⟳</span> Generazione…';
    } else {
      generateBtn.innerHTML = '<svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12 12 5 19 12"></polyline><line x1="12" y1="19" x2="12" y2="5"></line></svg> Genera comando';
    }
  }

  function updateOutput(command, explanation, confidence) {
    // Update terminal
    commandOutput.innerHTML = command
      ? '<code>' + escapeHTML(command) + '</code>'
      : '<code></code>';

    // Update explanation
    explanationText.textContent = explanation || '';

    // Update confidence badge
    if (confidence > 0) {
      confidenceBadge.classList.add('visible');
      let level;
      if (confidence >= 70) level = 'high';
      else if (confidence >= 40) level = 'medium';
      else level = 'low';

      confidenceBadge.className = 'confidence-badge visible ' + level;
      confidenceBadge.textContent = 'Confidenza ' + confidence + '%';
    } else {
      confidenceBadge.classList.remove('visible');
    }

    // Show output section
    if (command && command.trim().length > 0) {
      outputSection.classList.add('has-output');
      copyBtn.disabled = false;
    } else {
      outputSection.classList.remove('has-output');
      copyBtn.disabled = true;
    }
  }

  // ─── Copy to Clipboard ──────────────────────────────────────────
  copyBtn.addEventListener('click', async function () {
    if (!currentCommand) return;

    try {
      await navigator.clipboard.writeText(currentCommand);
      copyText.textContent = 'Copiato!';
      copyBtn.classList.add('copied');

      setTimeout(function () {
        copyText.textContent = 'Copia';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = currentCommand;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        copyText.textContent = 'Copiato!';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyText.textContent = 'Copia';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (e) {
        showError('Impossibile copiare il comando. Selezionalo e copialo manualmente.');
      }
      document.body.removeChild(textarea);
    }
  });

  // ─── Error Handling ─────────────────────────────────────────────
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
  }

  // ─── HTML Escape ────────────────────────────────────────────────
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Initial State ──────────────────────────────────────────────
  generateBtn.disabled = true;
})();
