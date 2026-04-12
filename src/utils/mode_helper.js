/**
 * 模式切换辅助函数
 */

/**
 * 互斥地激活指定的翻译模式
 * @param {Object} appConfig - 应用配置对象
 * @param {string} targetModeId - 目标激活的模式 ID (offline_dict, ollama, libretranslate)
 */
function setActiveMode(appConfig, targetModeId) {
    if (!appConfig.backends) {
        appConfig.backends = {};
    }

    // 将所有已知后端设为 false
    appConfig.backends.offline_dict = false;
    appConfig.backends.ollama = false;
    appConfig.backends.libretranslate = false;

    // 激活目标后端
    if (Object.prototype.hasOwnProperty.call(appConfig.backends, targetModeId)) {
        appConfig.backends[targetModeId] = true;
    } else {
        // 如果是新加的后端但不在 backends 对象中，也强制设为 true
        appConfig.backends[targetModeId] = true;
    }
}

module.exports = {
    setActiveMode
};
