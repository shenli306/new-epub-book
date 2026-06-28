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

  const { bookSource, bookUrl } = req.body || {};

  if (!bookSource || !bookUrl) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    console.log(`[Chapters] Fetching: ${bookUrl}`);

    let responseData;
    try {
      const response = await axios.get(bookUrl, {
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
        error: 'Failed to fetch chapters',
        message: fetchError.message
      });
    }

    const chapters = [];
    const ruleChapter = bookSource.ruleChapter || {};

    const isJsonApi = ruleChapter.chapterList && ruleChapter.chapterList.startsWith('$.');

    if (isJsonApi) {
      let jsonData;
      try {
        jsonData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      } catch (e) {
        jsonData = null;
      }

      if (jsonData && jsonData.data) {
        let chapterList = [];
        if (jsonData.data.list && Array.isArray(jsonData.data.list)) {
          chapterList = jsonData.data.list;
        } else if (Array.isArray(jsonData.data)) {
          chapterList = jsonData.data;
        }

        for (const item of chapterList) {
          const title = item.title || item.name || '';
          const itemId = item.item_id || item.id || '';
          let chapterUrl = ruleChapter.chapterUrl || '';
          chapterUrl = chapterUrl.replace(/\{\$\.item_id\}/gi, itemId);
          chapterUrl = chapterUrl.replace(/\{item_id\}/gi, itemId);

          if (title) {
            chapters.push({
              name: title,
              url: chapterUrl
            });
          }
        }
      }
    } else {
      const html = responseData;
      const chapterLinks = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi) || [];

      for (const link of chapterLinks) {
        const hrefMatch = link.match(/href=["']([^"']+)["']/);
        const textMatch = link.match(/>([^<]+)<\/a>/);

        if (hrefMatch && textMatch) {
          const url = hrefMatch[1];
          const text = textMatch[1].trim();

          if (text.length > 0 && text.length < 100 &&
              (url.includes('.html') || url.includes('/chapter/') || url.includes('/read/') || url.includes('?'))) {
            chapters.push({
              name: text,
              url: url.startsWith('http') ? url : new URL(url, bookUrl).href
            });
          }
        }
      }
    }

    res.json({
      success: true,
      count: chapters.length,
      chapters: chapters.slice(0, 200)
    });

  } catch (error) {
    console.error('Chapters error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch chapters',
      message: error.message
    });
  }
};
