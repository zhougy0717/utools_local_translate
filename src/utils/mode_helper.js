/**
 * 模式切换辅助函数
 */

/**
 * 互斥地激活指定的翻译模式
 * @param {Object} appConfig - 应用配置对象
 * @param {string} targetModeId - 目标激活的模式 ID (offline_dict, ollama, libretranslate)
 */
/**
 * 互斥地激活指定的翻译模式
 * @param {Object} appConfig - 应用配置对象
 * @param {string} targetModeId - 目标激活的模式 ID (offline_dict, ollama, libretranslate)
 */
function setActiveMode(appConfig, targetModeId) {
    if (typeof appConfig.setActiveBackend === 'function') {
        appConfig.setActiveBackend(targetModeId);
    } else {
        // 兼容性兜底：如果传入的是纯对象而非类实例
        if (!appConfig.backends) appConfig.backends = {};
        appConfig.backends.offline_dict = targetModeId === 'offline_dict';
        appConfig.backends.ollama = targetModeId === 'ollama';
        appConfig.backends.libretranslate = targetModeId === 'libretranslate';
        appConfig.activeBackend = targetModeId;
    }
}

module.exports = {
    setActiveMode
};
