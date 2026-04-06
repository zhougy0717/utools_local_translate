
/**
 * 组装正常的检索或翻译结果列表
 *
 * @param {string} searchWord - 用户输入的查询词
 * @param {{ found: boolean, translation?: string, phonetic?: string, message?: string }} result - 后端返回的数据模型
 * @param {boolean} isZhToEn - 是否为中→英结果（用于多释义拆条、拼音小字显示）
 * @param {number} [costTime] - 查询耗时（毫秒）
 * @param {string} [backendName] - 用于拼装查询时延条目的名字说明（如 "模型查询时延"、"Ollama 查询时延"）
 * @param {boolean} [showCostConfig=true] - 全局配置开关：是否显示耗时条目
 * @returns {Array<{title: string, description: string, icon?: string}>} 供 uTools 渲染的列表项数组
 */
function buildResultItems(searchWord, result, isZhToEn, costTime, backendName = '词典查询时延', showCostConfig = true) {
  let list = [];

  if (result.message) {
    list.push({ title: '词库未就绪', description: result.message });
  } else if (!result.found || !result.translation) {
    list.push({ title: '未找到释义', description: searchWord });
  } else {
    // 中→英：将多个释义用分号合并显示，不再拆条
    if (isZhToEn) {
      const pinyinPart = result.phonetic ? result.phonetic + ' · ' : '';
      const desc = pinyinPart + searchWord;
      const translation = result.translation || '（无释义）';

      list.push({
        title: translation.trim(),
        description: desc.trim(),
        copyText: translation
      });
    } else {
      // 英→中 或长自然段：直接显示，不再按宽度截断拆分多行
      const fullTranslationText = [result.phonetic, result.translation].filter(Boolean).join(' ') || '（无释义）';
      
      list.push({
        title: fullTranslationText.trim(),
        description: searchWord.trim(),
        copyText: fullTranslationText
      });
    }
  }

  // 追加 Ollama 进阶入口
  const targetLangCode = isZhToEn ? 'en' : 'zh';
  list.push({
    title: '✨ 使用 Ollama 进阶翻译...',
    description: '基于 AI 提供深度润色、语法剖析与多风格翻译',
    isAdvancedOllama: true,
    searchWord: searchWord,
    targetLangCode: targetLangCode,
    initialResult: result.translation || '',
    backendName: backendName
  });

  // 独立追加时延统计项
  if (costTime && showCostConfig) {
    const costSeconds = (costTime / 1000).toFixed(2);
    list.push({
      title: '⚡ 本地翻译耗时: ' + costSeconds + '秒',
      description: backendName,
      icon: ''
    });
  }

  return list;
}

/**
 * 组装正在加载的列表项
 * @param {string} loadingMessage - 加载提示文案
 */
function buildLoadingItem(loadingMessage = '正在检索中...') {
  return [{ title: '⏳ 正在检索中...', description: loadingMessage }];
}

/**
 * 组装查词或词典构建进度的列表项
 * @param {string} progressMsg - 进度提示文案
 */
function buildProgressItem(progressMsg) {
  const isDictTask = progressMsg.includes('下载') || progressMsg.includes('构建') || progressMsg.includes('解压');
  const title = isDictTask ? '词典状态同步' : '⏳ 正在拼命翻译中...';
  return [{ title: title, description: progressMsg }];
}

module.exports = {
  buildResultItems,
  buildLoadingItem,
  buildProgressItem
};
