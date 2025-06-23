const express = require('express');
const router = express.Router();

// POST /api/telegram/send
router.post('/send', async (req, res) => {
  try {
    const { chatId, text, parseMode } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ success: false, error: 'chatId and text are required' });
    }

    // Get the main Telegram connector from the registry
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector registry not available' });
    }
    const telegramConnector = connectorRegistry.getConnector('telegram-bot-main');
    if (!telegramConnector) {
      return res.status(500).json({ success: false, error: 'Telegram connector not found' });
    }

    // Send the message
    const result = await telegramConnector.execute('telegram:send', 'text', {
      chatId,
      text,
      parseMode: parseMode || 'Markdown'
    });

    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 