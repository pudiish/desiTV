const chatLogic = require('../services/chatLogic');

async function handleMessage(req, res) {
  try {
    const { message, sessionId, userId, channelId, context } = req.body;

    // Extract channelId from context if not at top level
    const actualChannelId = channelId || context?.currentChannelId;
    
    // Get IP address
    const userIp = req.ip || req.connection.remoteAddress;

    const result = await chatLogic.processMessage({
      message,
      sessionId,
      userId,
      channelId: actualChannelId,
      userIp
    });

    if (result.blocked) {
      return res.status(400).json({ response: result.response, blocked: true });
    }

    res.json(result);

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    if (error.message === 'Message is required' || error.message === 'Message too long') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Processing failed' });
  }
}

async function getSuggestions(req, res) {
  try {
    const suggestions = chatLogic.getSuggestions();
    res.json({ suggestions });
  } catch (error) {
    console.error('[Chat] Suggestions error:', error.message);
    res.status(500).json({ error: 'Failed' });
  }
}

module.exports = {
  handleMessage,
  getSuggestions
};
