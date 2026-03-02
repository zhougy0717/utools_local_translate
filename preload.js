/**
 * 阶段零 Demo：在 uTools 中验证 preload 能访问并查询 resources/ecdict.db
 * 使用列表模式，enter 时显示欢迎词；search 时根据输入查词并展示。
 * 支持：用户先 Ctrl+C 复制选中文字，再打开插件时自动读取剪贴板并查词。
 */
const { createEcdictBackend } = require('./backends/ecdict.js');
const { createHelsinkiBackend } = require('./backends/helsinki/helsinki.js');

const currentBackendId = 'helsinki'; // 默认选择 Helsinki 模型

const backend = currentBackendId === 'helsinki'
  ? createHelsinkiBackend()
  : createEcdictBackend();

const MAX_SELECTION_LENGTH = 200;

/** 检测文本是否包含中文（CJK 统一汉字），用于决定英→中或中→英 */
function isLikelyChinese(text) {
  if (!text || !String(text).trim()) return false;
  return /[\u4e00-\u9fff]/.test(String(text).trim());
}

/**
 * @param {string} searchWord - 用户输入的查询词
 * @param {{ found: boolean, translation?: string, phonetic?: string, message?: string }} result - 后端返回
 * @param {boolean} [isZhToEn] - 是否为中→英结果（用于多释义拆条、拼音小字显示）
 */
function buildListItems(searchWord, result, isZhToEn) {
  if (result.message) {
    return [{ title: '词库未就绪', description: result.message }];
  }
  if (!result.found || !result.translation) {
    return [{ title: '未找到释义', description: searchWord }];
  }
  // 中→英：拼音放 description（小字），同一中文的多个英文释义拆成多条列表项
  if (isZhToEn) {
    const pinyinPart = result.phonetic ? result.phonetic + ' · ' : '';
    const desc = pinyinPart + searchWord;
    const parts = result.translation.split(/\s*;\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length === 0) return [{ title: '（无释义）', description: searchWord }];
    return parts.map(function (en) {
      return { title: en, description: desc };
    });
  }
  // 英→中：title 为音标+释义，description 为被查词
  const translationText = [result.phonetic, result.translation].filter(Boolean).join(' ') || '（无释义）';
  return [{ title: translationText, description: searchWord }];
}

/** 使用 uTools 官方 API 读取剪贴板文本（与 getCopyedFiles 同系列） */
function readClipboardText() {
  if (typeof utools === 'undefined') return '';
  if (typeof utools.getCopyedText === 'function') return utools.getCopyedText() || '';
  return '';
}

function applyEnterWithWord(word, callbackSetList) {
  const w = word.trim();
  if (!w || w.length > MAX_SELECTION_LENGTH) return false;
  if (typeof utools !== 'undefined') utools.setSubInputValue(w);
  const sourceLang = isLikelyChinese(w) ? 'zh' : 'en';
  const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
  const isZhToEn = sourceLang === 'zh' && targetLang === 'en';
  backend.queryWord(w, sourceLang, targetLang, function (err, result) {
    callbackSetList(buildListItems(w, result || { found: false }, isZhToEn));
  });
  return true;
}

if (typeof window !== 'undefined') {
  window.exports = {
    dict: {
      mode: 'list',
      args: {
        placeholder: '输入单词或中文查词',
        enter: function (action, callbackSetList) {
          // 从超级面板等入口带入的选中文字：type 为 over，payload 为选中文本
          const payloadText =
            action && action.type === 'over' && typeof action.payload === 'string'
              ? action.payload.trim()
              : '';
          if (payloadText && applyEnterWithWord(payloadText, callbackSetList)) return;

          // 通过关键字进入：直接读取剪贴板（用户需先自行 Ctrl+C 复制选中文字），有内容则自动查词
          const text = readClipboardText();
          if (text && applyEnterWithWord(text, callbackSetList)) return;
          callbackSetList([
            { title: '欢迎使用本地词典', description: '先复制要查的词 (Ctrl+C)，再打开本插件即可自动查词；或在上方输入框输入单词' }
          ]);
        },
        search: function (action, searchWord, callbackSetList) {
          if (!searchWord || !searchWord.trim()) {
            callbackSetList([]);
            return;
          }
          const w = searchWord.trim();
          const sourceLang = isLikelyChinese(w) ? 'zh' : 'en';
          const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
          const isZhToEn = sourceLang === 'zh' && targetLang === 'en';
          backend.queryWord(w, sourceLang, targetLang, function (err, result) {
            callbackSetList(buildListItems(w, result || { found: false }, isZhToEn));
          });
        },
        select: function (action, itemData, callbackSetList) {
          let textToCopy = itemData.title;
          if (itemData.title === '词库未就绪' || itemData.title === '未找到释义' || itemData.title === '欢迎使用本地词典') {
            textToCopy = itemData.description;
          }
          if (typeof utools !== 'undefined') {
            utools.copyText(textToCopy);
            utools.hideMainWindow();
            utools.showNotification('已复制内容');
          }
        }
      }
    }
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.isLikelyChinese = isLikelyChinese;
}
