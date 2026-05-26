// Vercel serverless function — proxies AI requests to Anthropic
// API key lives on the server, never in the browser

export default async function handler(req, res) {
  // CORS — allow the frontend to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' });
  }

  try {
    const { system, messages, useSearch, maxTokens } = req.body;

    // Validate
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No valid messages provided' });
    }

    // Clean messages
    const cleanMessages = messages
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' 
          ? m.content 
          : Array.isArray(m.content) 
            ? m.content 
            : String(m.content || '')
      }))
      .filter(m => m.content !== '' && m.content !== undefined && m.content !== null);

    if (cleanMessages.length === 0) {
      return res.status(400).json({ error: 'No valid messages after cleaning' });
    }

    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 1000,
      messages: cleanMessages,
    };

    if (system && system.trim()) body.system = system;
    if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', response.status, data);
      return res.status(response.status).json({ 
        error: data.error?.message || 'Anthropic API error' 
      });
    }

    // Extract text content
    const text = data.content
      ?.map(b => b.type === 'text' ? b.text : '')
      .filter(Boolean)
      .join('') || '';

    return res.status(200).json({ text, raw: data });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
