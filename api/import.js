/**
 * 书源导入 API
 * 支持从 URL 导入书源配置
 */

const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // 验证 URL 格式
  let targetUrl;
  try {
    targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid protocol, only HTTP/HTTPS supported' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    console.log(`[Import] Fetching sources from: ${targetUrl.href}`);

    const response = await axios.get(targetUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 15000,
      responseType: 'text',
    });

    let sources;
    const content = response.data;

    // 尝试解析为 JSON
    if (typeof content === 'string') {
      // 清理可能的 BOM 字符
      const cleanContent = content.replace(/^\uFEFF/, '');
      
      // 尝试解析 JSON
      try {
        sources = JSON.parse(cleanContent);
      } catch (jsonError) {
        // 如果不是 JSON，检查是否是书源分享平台的格式
        // 常见格式：MyBookSource, BookFinder 等
        return res.status(400).json({ 
          error: 'Invalid format',
          message: 'The URL does not contain valid JSON book source data',
          details: 'Expected an array of book source objects'
        });
      }
    } else {
      sources = content;
    }

    // 确保是数组格式
    if (!Array.isArray(sources)) {
      // 如果是单个书源对象，包装成数组
      if (typeof sources === 'object' && sources !== null) {
        sources = [sources];
      } else {
        return res.status(400).json({ 
          error: 'Invalid format',
          message: 'Book sources must be an array or object'
        });
      }
    }

    // 验证书源结构
    const validSources = sources.filter(source => {
      return source && typeof source === 'object' && (
        source.bookSourceName || source.name || source.bookSourceUrl
      );
    });

    if (validSources.length === 0) {
      return res.status(400).json({ 
        error: 'No valid sources found',
        message: 'The imported data does not contain any valid book sources'
      });
    }

    // 为每个书源生成唯一 ID
    const importedSources = validSources.map((source, index) => ({
      id: source.id || `imported_${Date.now()}_${index}`,
      bookSourceUrl: source.bookSourceUrl || source.url || '',
      bookSourceName: source.bookSourceName || source.name || `导入书源 ${index + 1}`,
      bookSourceGroup: source.bookSourceGroup || source.group || '导入',
      enabled: source.enabled !== false,
      searchUrl: source.searchUrl || '',
      ruleSearch: source.ruleSearch || {},
      ruleChapter: source.ruleChapter || {},
      ruleContent: source.ruleContent || {}
    }));

    console.log(`[Import] Successfully imported ${importedSources.length} sources`);

    return res.json({
      success: true,
      count: importedSources.length,
      sources: importedSources,
      message: `成功导入 ${importedSources.length} 个书源`
    });

  } catch (error) {
    console.error('[Import] Error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'Failed to fetch URL within timeout period'
      });
    }
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'Failed to fetch URL',
        message: error.response.statusText
      });
    }

    return res.status(500).json({ 
      error: 'Import failed',
      message: error.message
    });
  }
};
