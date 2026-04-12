const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 默认的 LibreTranslate 服务器地址 (如果本地没开，尝试从官方公共服务器抓取)
const DEFAULT_URL = 'https://libretranslate.com/languages';

async function fetchLanguages(url = DEFAULT_URL) {
    console.log(`[Fetcher] Fetching languages from: ${url}...`);
    
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse response: ' + data.slice(0, 100)));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

function mapToLocalFormat(remoteLanguages) {
    // 基础的中文名映射 (LibreTranslate 默认返回英文名)
    const nameMap = {
        'en': '英语', 'zh': '简体中文', 'ja': '日语', 'ko': '韩语', 
        'fr': '法语', 'es': '西班牙语', 'ru': '俄语', 'de': '德语',
        'it': '意大利语', 'pt': '葡萄牙语', 'ar': '阿拉伯语', 'hi': '印地语'
    };

    const localList = [
        { code: 'auto', name: '自动推断 (反向翻译)', desc: '根据输入内容自动判断 (中翻英 / 英翻中)' }
    ];

    remoteLanguages.forEach(lang => {
        const zhName = nameMap[lang.code] || lang.name;
        localList.push({
            code: lang.code,
            name: `${zhName} (${lang.name})`,
            desc: `强制翻译为 ${zhName}`
        });
    });

    return localList;
}

async function run() {
    try {
        const remoteLangs = await fetchLanguages();
        const localLangs = mapToLocalFormat(remoteLangs);
        
        const content = `/**
 * 该文件由 scripts/fetch_libre_languages.js 自动生成
 * 包含了 LibreTranslate 官方支持的语言列表
 */
module.exports = ${JSON.stringify(localLangs, null, 4)};
`;
        
        const targetPath = path.join(__dirname, '../src/commands/languages.js');
        fs.writeFileSync(targetPath, content);
        
        console.log(`[Success] Successfully fetched ${localLangs.length} languages.`);
        console.log(`[Success] Saved to: ${targetPath}`);
    } catch (e) {
        console.error(`[Error] ${e.message}`);
        process.exit(1);
    }
}

run();
