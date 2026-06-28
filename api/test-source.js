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

  const { bookSource } = req.body || {};

  if (!bookSource) {
    return res.status(400).json({ error: 'Missing bookSource' });
  }

  try {
    const searchUrl = bookSource.searchUrl?.replace(/\{key\}/gi, '测试');

    if (!searchUrl) {
      return res.json({
        success: false,
        message: '缺少 searchUrl 配置'
      });
    }

    console.log(`[Test] Testing: ${searchUrl}`);

    let responseData;
    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        timeout: 10000,
      });
      responseData = response.data;
    } catch (fetchError) {
      return res.json({
        success: false,
        message: fetchError.message,
        code: fetchError.code
      });
    }

    const htmlLength = typeof responseData === 'string' ? responseData.length : JSON.stringify(responseData).length;

    if (responseData && htmlLength > 100) {
      res.json({
        success: true,
        message: '书源可用',
        htmlLength: htmlLength
      });
    } else {
      res.json({
        success: false,
        message: '书源返回内容为空'
      });
    }

  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      code: error.code
    });
  }
};
