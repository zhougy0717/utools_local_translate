/**
 * 使用 uTools 官方 API 读取剪贴板文本
 * @returns {string} 剪贴板文本
 */
function readClipboardText() {
  if (typeof utools === 'undefined') return '';
  if (typeof utools.getCopyedText === 'function') return utools.getCopyedText() || '';
  return '';
}

/**
 * 检测文本是否包含中文（CJK 统一汉字），用于决定英→中或中→英
 * @param {string} text 
 * @returns {boolean}
 */
function isLikelyChinese(text) {
  if (!text || !String(text).trim()) return false;
  return /[\u4e00-\u9fff]/.test(String(text).trim());
}

module.exports = {
  readClipboardText,
  isLikelyChinese
};
