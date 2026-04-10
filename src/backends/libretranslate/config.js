/**
 * LibreTranslate Backend 配置类
 * 存储键: backend_libretranslate
 */
const { AbstractBackendConfig } = require('../base/config');

const LIBRETRANSLATE_DEFAULTS = {
  apiBase: 'http://127.0.0.1:5000',
  apiKey: '',
  sourceLang: 'auto',
  targetLang: 'zh'
};

class LibreTranslateConfig extends AbstractBackendConfig {
  constructor() {
    super('backend_libretranslate', LIBRETRANSLATE_DEFAULTS);
  }
}

module.exports = {
  LibreTranslateConfig,
  LIBRETRANSLATE_DEFAULTS
};
