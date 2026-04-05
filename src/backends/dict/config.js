/**
 * Dict Backend 配置类
 * 存储键: backend_dict
 */
const { AbstractBackendConfig } = require('../base/config');

const DICT_DEFAULTS = {
  dictRepoPath: '',
  useProxy: false
};

class DictConfig extends AbstractBackendConfig {
  constructor() {
    super('backend_dict', DICT_DEFAULTS);
  }
}

module.exports = {
  DictConfig,
  DICT_DEFAULTS
};
