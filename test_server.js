const axios = require('axios');
const fs = require('fs');

async function testSearch() {
    const keyword = '轮回';
    const searchUrl = `https://www.huanmengacg.com/index.php/book/search?key=${encodeURIComponent(keyword)}`;

    console.log(`Fetching: ${searchUrl}`);

    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
            timeout: 15000,
        });

        const html = response.data;

        // 保存 HTML 到文件以便调试
        fs.writeFileSync('/tmp/search_html.html', html);
        console.log('HTML saved to /tmp/search_html.html');

        // 匹配 bigpic-book-name 链接（href 可能在 class 之前或之后）
        const pattern = /<a[^>]*href=["']([^"']+)["'][^>]*class=["']bigpic-book-name["'][^>]*>([^<]+)<\/a>/gi;
        const matches = [];
        let match;
        while ((match = pattern.exec(html)) !== null) {
            matches.push({
                url: match[1],
                name: match[2].trim()
            });
        }

        console.log(`Found ${matches.length} book links with bigpic-book-name class`);

        // 如果上面的方法不工作，尝试更通用的方法
        if (matches.length === 0) {
            console.log('Trying generic link extraction...');
            // 提取所有 /book/info/ 链接
            const bookLinks = html.match(/href=["']([^"']*\/book\/info\/[^"']+)["']/gi) || [];
            console.log(`Found ${bookLinks.length} book/info links`);
            console.log('Sample:', bookLinks.slice(0, 3));
        }

        console.log('Matches:', matches.slice(0, 5));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSearch();
