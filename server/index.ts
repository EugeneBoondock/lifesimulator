import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

if (!DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY not set in environment');
}

app.post('/api/ai/decide', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { messages, temperature = 0.7, max_tokens = 300 } = req.body;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '{}';

    res.json({ content, usage: data.usage });
  } catch (error: any) {
    console.error('DeepSeek proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/batch', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { requests } = req.body;
    const results = await Promise.allSettled(
      requests.map(async (r: any) => {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: r.messages,
            temperature: r.temperature || 0.7,
            max_tokens: r.max_tokens || 200,
            response_format: { type: 'json_object' },
          }),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || '{}';
      })
    );

    res.json({
      results: results.map(r =>
        r.status === 'fulfilled' ? { success: true, content: r.value } : { success: false, error: (r as any).reason?.message }
      )
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!DEEPSEEK_API_KEY });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aetheria AI Backend running on http://localhost:${PORT}`);
  console.log(`DeepSeek API key: ${DEEPSEEK_API_KEY ? 'configured' : 'MISSING'}`);
});
