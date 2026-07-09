const express = require('express');
const path = require('path');
const { translate } = require('./translator');

const app = express();
const PORT = process.env.PORT || 4600;

// Parse JSON bodies
app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint
app.post('/api/generate', (req, res) => {
  const { description } = req.body;

  if (!description || typeof description !== 'string') {
    return res.status(400).json({
      error: 'Fornisci una descrizione testuale in italiano.',
      command: '',
      explanation: '',
      confidence: 0
    });
  }

  const result = translate(description.trim());
  res.json(result);
});

// Fallback: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PowerShellino in esecuzione su http://0.0.0.0:${PORT}`);
});
