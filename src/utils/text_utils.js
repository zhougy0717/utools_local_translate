/**
 * 文本处理辅助工具
 */

/**
 * 获取字符的显示宽度权重
 * @param {string} char 
 * @returns {number} 全角/宽字符返回 2，半角返回 1
 */
function getCharWidth(char) {
  if (!char) return 0;
  return char.charCodeAt(0) > 255 ? 2 : 1;
}

module.exports = {
  getCharWidth
};
