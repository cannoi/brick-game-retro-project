const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', step: 'breakout' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Brick Game Console Breakout Mode running on port ${PORT}`);
});
