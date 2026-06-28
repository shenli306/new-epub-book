const defaultSources = [
  {
    id: 'src_default_1',
    bookSourceUrl: 'https://www.huanmengacg.com',
    bookSourceName: '幻梦轻小说',
    bookSourceGroup: '轻小说',
    enabled: true,
    searchUrl: 'https://www.huanmengacg.com/index.php/book/search?key={key}',
    ruleSearch: {
      method: 'GET',
      bookList: 'dl',
      bookName: 'a.bigpic-book-name',
      bookAuthor: 'p:has(i.fa-user-circle-o)',
      bookUrl: 'a.bigpic-book-name@href',
      bookCover: 'a img@data-original',
      bookStatus: '',
      bookCategory: '',
      bookIntro: ''
    },
    ruleChapter: {
      chapterList: 'ul#chapterlist li a',
      chapterName: 'text',
      chapterUrl: '@href'
    },
    ruleContent: {
      content: 'div#BookText'
    }
  },
  {
    id: 'src_fanqie_1',
    bookSourceUrl: 'https://www.souhh.com',
    bookSourceName: '番茄小说',
    bookSourceGroup: '综合',
    enabled: true,
    searchUrl: 'https://www.souhh.com/api/search?key={key}&tab_type=3&offset=0',
    ruleSearch: {
      method: 'GET',
      bookList: '$.data[*]',
      bookName: '$.book_name',
      bookAuthor: '$.author',
      bookUrl: 'https://www.souhh.com/api/chapter?book_id={$.book_id}&book_type={$.tab}',
      bookCover: '$.thumb_url',
      bookStatus: '',
      bookCategory: '',
      bookIntro: '$.abstract'
    },
    ruleChapter: {
      chapterList: '$.data.list[*]',
      chapterName: '$.title',
      chapterUrl: 'https://www.souhh.com/api/content?item_id={$.item_id}'
    },
    ruleContent: {
      content: '$.data.content'
    }
  }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method === 'GET') {
    return res.json(defaultSources);
  }

  if (req.method === 'POST') {
    const sources = req.body;
    if (!Array.isArray(sources)) {
      return res.status(400).json({ error: 'Expected array' });
    }
    return res.json({ success: true, count: sources.length, message: 'Vercel Serverless 模式下不支持持久化存储' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
