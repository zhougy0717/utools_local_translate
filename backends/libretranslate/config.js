/**
 * LibreTranslate Backend 配置类
 * 存储键: backend_libretranslate
 */
const { AbstractBackendConfig } = require('../base/config');

const LIBRETRANSLATE_DEFAULTS = {
  apiBase: '',
  apiKey: ''
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
