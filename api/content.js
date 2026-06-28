const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bookSource, chapterUrl } = req.body || {};

  if (!bookSource || !chapterUrl) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    console.log(`[Content] Fetching: ${chapterUrl}`);

    let responseData;
    try {
      const response = await axios.get(chapterUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        timeout: 15000,
      });
      responseData = response.data;
    } catch (fetchError) {
      return res.status(500).json({
        error: 'Failed to fetch content',
        message: fetchError.message
      });
    }

    let content = '';
    const ruleContent = bookSource.ruleContent || {};

    const isJsonApi = ruleContent.content && ruleContent.content.startsWith('$.');

    if (isJsonApi) {
      let jsonData;
      try {
        jsonData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      } catch (e) {
        jsonData = null;
      }

      if (jsonData && jsonData.data && jsonData.data.content) {
        content = jsonData.data.content;
      }
    } else {
      const html = responseData;
      const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
      if (paragraphs.length > 0) {
        content = paragraphs.map(p => p.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 10).join('\n\n');
      }

      if (!content) {
        const divs = html.match(/<div[^>]*(?:class=["'][^"']*content[^"']*|id=["']content["'])[^>]*>([\s\S]*?)<\/div>/gi) || [];
        if (divs.length > 0) {
          content = divs.map(d => d.replace(/<[^>]+>/g, '\n').trim()).join('\n\n');
        }
      }
    }

    content = content.replace(/\\n{3,}/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim();

    res.json({
      success: true,
      content: content,
      url: chapterUrl
    });

  } catch (error) {
    console.error('Content error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch content',
      message: error.message
    });
  }
};
