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

/**
 * 根据内容自动判定源语言和目标语言
 * @param {string} text - 待判定文本
 * @param {string} [targetOverride='auto'] - 强制指定的目标语言 (可选)
 * @returns {{source: string, target: string, isZhToEn: boolean}}
 */
function detectLanguages(text, targetOverride = 'auto') {
  const isZh = isLikelyChinese(text);
  const source = isZh ? 'zh' : 'en';
  
  // 如果用户指定了非 auto 的目标语言，则直接使用
  if (targetOverride && targetOverride !== 'auto') {
    return { source, target: targetOverride, isZhToEn: isZh };
  }

  // 默认逻辑：自动反向翻译 (中->英, 非中->中)
  const target = isZh ? 'en' : 'zh';
  return { source, target, isZhToEn: isZh };
}

module.exports = {
  readClipboardText,
  isLikelyChinese,
  detectLanguages
};
