/**
 * EPUB 液态玻璃灵动岛 - Node.js 服务端
 * 支持书源代理抓取、CORS 跨域、书源数据持久化
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'bookSources.json');

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ==============================================
// 工具函数：HTML 解析（简化的 CSS 选择器）
// ==============================================

function parseSelector(html, selector) {
    // 处理 @attr 获取属性
    const attrMatch = selector.match(/^(.+?)@([a-zA-Z-]+)$/);
    if (attrMatch) {
        const [, elementSelector, attrName] = attrMatch;
        const regex = createRegex(elementSelector);
        const match = html.match(regex);
        if (match) {
            const attrRegex = new RegExp(`${escapeRegex(elementSelector)}[^>]*${attrName}=["']([^"']*)["']`, 'i');
            const attrMatch = html.match(attrRegex);
            return attrMatch ? attrMatch[1] : '';
        }
        return '';
    }

    // 处理 text 获取文本
    if (selector === 'text') {
        return html.trim();
    }

    // 普通元素选择器
    const regex = createRegex(selector);
    return html.match(regex)?.[0] || '';
}

function createRegex(selector) {
    const parts = selector.trim().split(/\s+/);
    let regexStr = '';

    for (const part of parts) {
        if (part.startsWith('.')) {
            const className = part.slice(1);
            regexStr += `[^>]*class=["'][^"']*${escapeRegex(className)}[^"']*["'][^>]*`;
        } else if (part.startsWith('#')) {
            const idName = part.slice(1);
            regexStr += `[^>]*id=["']${escapeRegex(idName)}["'][^>]*`;
        } else {
            regexStr += `<${part}[^>]*>`;
        }
    }

    return new RegExp(regexStr, 'i');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractText(html, selector) {
    const elementMatch = html.match(new RegExp(`<[^>]+class=["'][^"']*${selector.replace('.', '\\.')}[^"']*["'][^>]*>([\\s\\S]*?)<`, 'i'));
    if (elementMatch) {
        return elementMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

function extractList(html, listSelector, itemSelector, fields) {
    const result = [];

    // 找到列表容器
    let listContent = '';

    // 尝试多种方式找到列表
    const classMatch = html.match(new RegExp(`class=["'][^"']*${escapeRegex(listSelector.replace('.', ''))}[^"']*["']`, 'i'));
    const idMatch = html.match(new RegExp(`id=["']${escapeRegex(listSelector.replace('#', ''))}["']`, 'i'));

    if (classMatch) {
        const before = html.substring(0, html.indexOf(classMatch[0]));
        const afterStart = html.indexOf(classMatch[0]);
        const after = html.substring(afterStart);
        const closeMatch = after.match(/<\/[^>]+>/);
        if (closeMatch) {
            listContent = after.substring(0, after.indexOf(closeMatch[0]) + closeMatch[0].length);
        }
    } else if (idMatch) {
        const before = html.substring(0, html.indexOf(idMatch[0]));
        const afterStart = html.indexOf(idMatch[0]);
        const after = html.substring(afterStart);
        const closeMatch = after.match(/<\/[^>]+>/);
        if (closeMatch) {
            listContent = after.substring(0, after.indexOf(closeMatch[0]) + closeMatch[0].length);
        }
    }

    if (!listContent) {
        listContent = html; // 使用整页内容
    }

    // 提取所有链接作为书籍
    const links = listContent.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi) || [];

    for (const link of links) {
        const hrefMatch = link.match(/href=["']([^"']+)["']/);
        const textMatch = link.match(/>([^<]+)</);

        if (hrefMatch && textMatch) {
            const url = hrefMatch[1];
            const text = textMatch[1].replace(/<[^>]+>/g, '').trim();

            // 过滤链接
            if (text.length > 1 && text.length < 100 &&
                (url.includes('.html') || url.includes('/book/') || url.includes('/novel/'))) {

                const book = {
                    name: text,
                    url: url.startsWith('http') ? url : url,
                    author: fields.bookAuthor ? extractText(link, fields.bookAuthor) : '',
                    cover: fields.bookCover ? parseSelector(link, fields.bookCover) : '',
                    intro: fields.bookIntro ? extractText(link, fields.bookIntro) : ''
                };

                // 提取书名
                if (fields.bookName && fields.bookName !== 'text') {
                    const nameMatch = link.match(new RegExp(`class=["'][^"']*${escapeRegex(fields.bookName.replace('.', ''))}[^"']*["'][^>]*>([^<]+)`, 'i'));
                    if (nameMatch) book.name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
                }

                result.push(book);
            }
        }
    }

    return result;
}

// ==============================================
// 代理接口：转发请求到目标网站
// ==============================================

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const urlObj = new URL(targetUrl);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return res.status(400).json({ error: 'Invalid protocol' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
            },
            timeout: 15000,
            responseType: 'text',
        });

        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });

        res.send(response.data);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch URL',
            message: error.message,
            code: error.code
        });
    }
});

app.options('/proxy', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.sendStatus(200);
});

// ==============================================
// 书源搜索接口
// ==============================================

app.post('/api/search', async (req, res) => {
    const { bookSource, keyword } = req.body;

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

        let html;
        try {
            const proxyUrl = `http://localhost:${PORT}/proxy?url=${encodeURIComponent(searchUrl)}`;
            const response = await axios.get(proxyUrl, { timeout: 15000 });
            html = response.data;
        } catch (proxyError) {
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                },
                timeout: 15000,
            });
            html = response.data;
        }

        // 解析搜索结果
        const ruleSearch = bookSource.ruleSearch || {};
        const books = [];

        // 根据配置的选择器提取书籍
        let bookPattern;
        if (ruleSearch.bookName && ruleSearch.bookName.includes('bigpic-book-name')) {
            // 幻梦轻小说：直接匹配 bigpic-book-name 类名的链接
            bookPattern = /<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*bigpic-book-name[^"']*["'][^>]*>([^<]+)<\/a>/gi;
        } else {
            // 通用模式：提取所有书籍相关链接
            bookPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi;
        }

        const allLinks = html.match(bookPattern) || [];

        for (const link of allLinks) {
            const hrefMatch = link.match(/href=["']([^"']+)["']/);
            const textMatch = link.match(/>([^<]+)</);

            if (hrefMatch && textMatch) {
                const url = hrefMatch[1];
                const text = textMatch[1].replace(/<[^>]+>/g, '').trim();

                // 过滤书籍详情链接
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
});

// ==============================================
// 书源章节列表接口
// ==============================================

app.post('/api/chapters', async (req, res) => {
    const { bookSource, bookUrl } = req.body;

    if (!bookSource || !bookUrl) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        console.log(`[Chapters] Fetching: ${bookUrl}`);

        let html;
        try {
            const proxyUrl = `http://localhost:${PORT}/proxy?url=${encodeURIComponent(bookUrl)}`;
            const response = await axios.get(proxyUrl, { timeout: 15000 });
            html = response.data;
        } catch {
            const response = await axios.get(bookUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                },
                timeout: 15000,
            });
            html = response.data;
        }

        const chapters = [];

        // 提取章节链接
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
});

// ==============================================
// 书源正文接口
// ==============================================

app.post('/api/content', async (req, res) => {
    const { bookSource, chapterUrl } = req.body;

    if (!bookSource || !chapterUrl) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        console.log(`[Content] Fetching: ${chapterUrl}`);

        let html;
        try {
            const proxyUrl = `http://localhost:${PORT}/proxy?url=${encodeURIComponent(chapterUrl)}`;
            const response = await axios.get(proxyUrl, { timeout: 15000 });
            html = response.data;
        } catch {
            const response = await axios.get(chapterUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                },
                timeout: 15000,
            });
            html = response.data;
        }

        let content = '';

        // 尝试提取正文段落
        const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
        if (paragraphs.length > 0) {
            content = paragraphs.map(p => p.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 10).join('\n\n');
        }

        // 备用：提取 div 内容
        if (!content) {
            const divs = html.match(/<div[^>]*(?:class=["'][^"']*content[^"']*|id=["']content["'])[^>]*>([\\s\\S]*?)<\/div>/gi) || [];
            if (divs.length > 0) {
                content = divs.map(d => d.replace(/<[^>]+>/g, '\n').trim()).join('\n\n');
            }
        }

        // 清理
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
});

// ==============================================
// 书源数据管理 API
// ==============================================

app.get('/api/sources', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            const defaultSources = [
                {
                    id: 'src_default_1',
                    bookSourceUrl: 'https://www.huanmengacg.com',
                    bookSourceName: '幻梦轻小说',
                    bookSourceGroup: '轻小说',
                    enabled: true,
                    searchUrl: 'https://www.huanmengacg.com/index.php/book/search?q={key}',
                    ruleSearch: {
                        method: 'GET',
                        bookList: '.common-list',
                        bookName: 'dl.common-info dt',
                        bookAuthor: 'span.pipe-z',
                        bookUrl: 'a.details-part@href',
                        bookCover: 'img@data-original',
                        bookStatus: 'span.pipe-s2',
                        bookCategory: 'span.pipe-s1',
                        bookIntro: 'dd.book-profile'
                    },
                    ruleChapter: {
                        chapterList: 'ul#chapterlist li a',
                        chapterName: 'text',
                        chapterUrl: '@href'
                    },
                    ruleContent: {
                        content: 'div#BookText'
                    }
                }
            ];
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultSources, null, 2));
            res.json(defaultSources);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sources', (req, res) => {
    try {
        const sources = req.body;
        if (!Array.isArray(sources)) {
            return res.status(400).json({ error: 'Expected array' });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(sources, null, 2));
        res.json({ success: true, count: sources.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 测试书源可用性
app.post('/api/test-source', async (req, res) => {
    const { bookSource } = req.body;

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

        let html;
        try {
            const proxyUrl = `http://localhost:${PORT}/proxy?url=${encodeURIComponent(searchUrl)}`;
            const response = await axios.get(proxyUrl, { timeout: 10000 });
            html = response.data;
        } catch {
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                },
                timeout: 10000,
            });
            html = response.data;
        }

        if (html && html.length > 100) {
            res.json({
                success: true,
                message: '书源可用',
                htmlLength: html.length
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
});

// ==============================================
// 健康检查
// ==============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ==============================================
// 启动服务器
// ==============================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   EPUB 液态玻璃灵动岛 - 服务端已启动               ║
║                                                   ║
║   本地访问: http://localhost:${PORT}                  ║
║                                                   ║
║   API 接口:                                       ║
║   • GET  /proxy?url=...     代理转发请求          ║
║   • POST /api/search        书源搜索              ║
║   • POST /api/chapters      获取章节列表          ║
║   • POST /api/content       获取正文内容          ║
║   • GET  /api/sources      获取书源列表          ║
║   • POST /api/sources      保存书源列表          ║
║   • POST /api/test-source   测试书源              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});
