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

  const { bookSource, keyword } = req.body || {};

  if (!bookSource || !bookSource.searchUrl) {
    return res.status(400).json({ error: 'Missing bookSource or searchUrl' });
  }

  if (!keyword) {
    return res.status(400).json({ error: 'Missing keyword' });
  }

  try {
    let searchUrl = bookSource.searchUrl.replace(/\{key\}/gi, encodeURIComponent(keyword));
    searchUrl = searchUrl.replace(/\{keyword\}/gi, encodeURIComponent(keyword));

    console.log(`[Search] Fetching: ${searchUrl}`);

    let responseData;
    try {
      const response = await axios.get(searchUrl, {
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
        error: 'Failed to fetch search results',
        message: fetchError.message
      });
    }

    const ruleSearch = bookSource.ruleSearch || {};
    const books = [];

    const isJsonApi = ruleSearch.bookList && ruleSearch.bookList.startsWith('$.');

    if (isJsonApi) {
      let jsonData;
      try {
        jsonData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      } catch (e) {
        jsonData = null;
      }

      if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
        for (const item of jsonData.data) {
          const name = item.book_name || item.name || '';
          const author = item.author || '';
          const cover = item.thumb_url || item.coverUrl || '';
          const intro = item.abstract || item.intro || '';
          const bookId = item.book_id || item.bookId || '';
          const tab = item.tab || '';

          if (name) {
            let bookUrl = ruleSearch.bookUrl || '';
            bookUrl = bookUrl.replace(/\{\$\.book_id\}/gi, bookId);
            bookUrl = bookUrl.replace(/\{\$\.tab\}/gi, tab);
            bookUrl = bookUrl.replace(/\{book_id\}/gi, bookId);
            bookUrl = bookUrl.replace(/\{tab\}/gi, tab);

            books.push({
              name: name,
              url: bookUrl,
              author: author,
              cover: cover,
              intro: intro
            });
          }
        }
      }
    } else {
      const html = responseData;
      let bookPattern;
      if (ruleSearch.bookName && ruleSearch.bookName.includes('bigpic-book-name')) {
        bookPattern = /<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*bigpic-book-name[^"']*["'][^>]*>([^<]+)<\/a>/gi;
      } else {
        bookPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi;
      }

      const allLinks = html.match(bookPattern) || [];

      for (const link of allLinks) {
        const hrefMatch = link.match(/href=["']([^"']+)["']/);
        const textMatch = link.match(/>([^<]+)</);

        if (hrefMatch && textMatch) {
          const url = hrefMatch[1];
          const text = textMatch[1].replace(/<[^>]+>/g, '').trim();

          if (text.length > 1 && text.length < 100 &&
              (url.includes('.html') || url.includes('/book/') || url.includes('/novel/') || url.includes('/info/'))) {
            books.push({
              name: text,
              url: url.startsWith('http') ? url : url,
              author: '',
              cover: '',
              intro: ''
            });
          }
        }
      }
    }

    if (books.length === 0) {
      return res.json({
        success: false,
        message: '未找到匹配的书籍',
        books: []
      });
    }

    res.json({
      success: true,
      bookSourceName: bookSource.bookSourceName,
      keyword: keyword,
      count: books.length,
      books: books.slice(0, 20)
    });

  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
};
