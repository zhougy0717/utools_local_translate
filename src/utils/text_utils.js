/**
 * 文本处理辅助工具
 */

/**
 * 获取字符的显示宽度权
 * @param {string} char 
 * @returns {number} 全角/宽字符返回 2，半角返回 1
 */
function getCharWidth(char) {
  if (!char) return 0;
  return char.charCodeAt(0) > 255 ? 2 : 1;
}

/**
 * 将英文短语转换为多种变量命名风格
 * @param {string} phrase 原始短语 (通常由空格/符号分割)
 * @returns {Object} 包含各风格的键值对
 */
function toNamingStyles(phrase) {
  if (!phrase) return { pascal: '', camel: '', snake: '', constant: '', kebab: '' };

  // 1. 清理：去除两端空格，将非字母数字字符替换为空格，合并多空格
  const clean = phrase.trim()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
  
  if (!clean) return { pascal: '', camel: '', snake: '', constant: '', kebab: '' };
  
  const words = clean.split(' ');

  return {
    // 大驼峰 (PascalCase)
    pascal: words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
    // 小驼峰 (camelCase)
    camel: words.map((w, index) => index === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
    // 下划线 (snake_case)
    snake: words.map(w => w.toLowerCase()).join('_'),
    // 常量名 (CONSTANT_CASE)
    constant: words.map(w => w.toUpperCase()).join('_'),
    // 短横线 (kebab-case)
    kebab: words.map(w => w.toLowerCase()).join('-')
  };
}

module.exports = {
  getCharWidth,
  toNamingStyles
};
