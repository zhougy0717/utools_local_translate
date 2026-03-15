/**
 * Dict Backend 配置类
 * 存储键: backend_dict
 */
const { AbstractBackendConfig } = require('../base/config');

const DICT_DEFAULTS = {
  dictRepoPath: ''
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
