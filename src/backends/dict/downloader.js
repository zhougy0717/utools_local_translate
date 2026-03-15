/**
 * 词典下载管理器
 * 支持 ECDICT 和 CC-CEDICT 词典下载，提供进度回调和代理支持
 * 支持断点续传功能
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ECDICT 下载地址 (GitHub Releases)
// 版本 1.0.28, 发布于 2017-09-20
const ECDICT_URL = 'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip';
const ECDICT_FILENAME = 'ecdict-sqlite-28.zip';

// CC-CEDICT 下载地址 (MDBG)
// 注意：MDBG的下载链接可能需要动态获取，这里提供备用镜像
const CCCEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip';
const CCCEDICT_FILENAME = 'cedict_1_0_ts_utf-8_mdbg.zip';

// 下载超时时间（毫秒）
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5分钟

// 最大重定向次数
const MAX_REDIRECTS = 5;

// 临时文件后缀（用于断点续传）
const TEMP_SUFFIX = '.downloading';

/**
 * 格式化字节数为人类可读格式
 * @param {number} bytes 字节数
 * @returns {string} 格式化后的字符串 (如 "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * DictDownloader 类
 * 管理词典文件的下载过程，提供统一的下载接口，支持代理配置和进度回调
 */
class DictDownloader {
  /**
   * @param {Object} options 配置选项
   * @param {string} options.destDir 目标存储目录
   * @param {string} [options.proxy] 代理服务器地址 (如 http://127.0.0.1:7890)
   */
  constructor(options) {
    if (!options || !options.destDir) {
      throw new Error('destDir is required');
    }
    this.destDir = options.destDir;
    this.proxy = options.proxy || null;
    this.agent = null;

    // 如果配置了代理，创建 Agent
    if (this.proxy) {
      try {
        this.agent = new HttpsProxyAgent(this.proxy);
      } catch (e) {
        console.error('Failed to create proxy agent:', e);
      }
    }

    // 确保目标目录存在
    if (!fs.existsSync(this.destDir)) {
      fs.mkdirSync(this.destDir, { recursive: true });
    }
  }

  /**
   * 获取已下载文件的大小（用于断点续传）
   * @param {string} filePath 文件路径
   * @returns {number} 已下载的字节数，文件不存在返回 0
   */
  _getExistingFileSize(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.size;
      }
    } catch (e) {
      // 忽略错误，返回 0
    }
    return 0;
  }

  /**
   * 检查服务器是否支持断点续传
   * @param {Object} headers 响应头
   * @returns {boolean} 是否支持断点续传
   */
  _supportsRangeRequests(headers) {
    return headers['accept-ranges'] === 'bytes';
  }

  /**
   * 下载通用方法（支持重定向和断点续传）
   * @param {string} url 下载地址
   * @param {string} filename 保存文件名
   * @param {Function} onProgress 进度回调函数
   * @param {Object} options 可选参数
   * @param {number} options.redirectCount 当前重定向次数
   * @param {boolean} options.disableResume 是否禁用断点续传
   * @returns {Promise<{success: boolean, path: string, error?: Error, resumed?: boolean}>}
   */
  async downloadFile(url, filename, onProgress, options = {}) {
    const { redirectCount = 0, disableResume = false } = options;
    const destPath = path.join(this.destDir, filename);
    const tempPath = destPath + TEMP_SUFFIX;

    // 检查重定向次数
    if (redirectCount > MAX_REDIRECTS) {
      return {
        success: false,
        path: destPath,
        error: new Error('Too many redirects')
      };
    }

    // 检查临时文件（断点续传）- 优先检查
    let startPosition = 0;
    let useTempFile = false;

    if (!disableResume && fs.existsSync(tempPath)) {
      startPosition = this._getExistingFileSize(tempPath);
      if (startPosition > 0) {
        useTempFile = true;
        console.log(`断点续传: 从 ${formatBytes(startPosition)} 处继续下载`);
      }
    }

    // 检查最终文件是否已存在（完整下载）
    // 只有在没有临时文件的情况下才跳过下载
    if (!useTempFile && fs.existsSync(destPath)) {
      const fileSize = this._getExistingFileSize(destPath);
      if (fileSize > 0) {
        // 文件已存在，跳过下载
        return {
          success: true,
          path: destPath,
          resumed: false,
          skipped: true
        };
      }
    }

    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: DOWNLOAD_TIMEOUT,
        headers: {}
      };

      // 如果有已下载的部分，添加 Range 头
      if (startPosition > 0) {
        requestOptions.headers['Range'] = `bytes=${startPosition}-`;
      }

      // 使用代理 agent
      if (this.agent) {
        requestOptions.agent = this.agent;
      }

      const req = protocol.request(requestOptions, (res) => {
        // 处理重定向 (301, 302, 303, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          console.log(`Redirect ${res.statusCode} -> ${redirectUrl}`);
          // 递归处理重定向，传递临时文件信息
          this.downloadFile(redirectUrl, filename, onProgress, {
            redirectCount: redirectCount + 1,
            disableResume
          }).then(resolve);
          return;
        }

        // 检查响应状态码
        // 200: 完整下载（服务器不支持 Range 或从头开始）
        // 206: Partial Content，断点续传成功
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          resolve({
            success: false,
            path: destPath,
            error: new Error(`HTTP Error: ${res.statusCode}`)
          });
          return;
        }

        const isResume = res.statusCode === 206;
        const contentLength = parseInt(res.headers['content-range']?.split('/')[1], 10) ||
                              parseInt(res.headers['content-length'], 10) || 0;

        // 计算总大小（断点续传时需要加上已下载的部分）
        const totalSize = isResume ? contentLength : contentLength;
        let downloadedThisSession = 0;

        // 确定写入路径：始终先写入临时文件，成功后再重命名
        const writePath = tempPath;
        const writeMode = isResume ? 'a' : 'w';

        // 如果服务器返回 200 但我们有临时文件，说明服务器不支持断点续传
        // 需要删除临时文件重新下载
        if (res.statusCode === 200 && useTempFile) {
          console.log('服务器不支持断点续传，重新下载');
          fs.unlinkSync(tempPath);
          startPosition = 0;
          useTempFile = false;
        }

        // 如果使用临时文件且是新下载，确保从头开始
        if (!isResume && useTempFile && res.statusCode === 200) {
          // 已经在上面处理了
        }

        // 创建文件写入流
        const fileStream = fs.createWriteStream(writePath, { flags: isResume ? 'a' : 'w' });

        // 如果有进度回调且知道总大小，显示初始状态
        if (onProgress && totalSize > 0) {
          const initialDownloaded = isResume ? startPosition : 0;
          const percent = Math.round((initialDownloaded / totalSize) * 100);
          onProgress(percent, initialDownloaded, totalSize);
        }

        // 数据流处理
        res.on('data', (chunk) => {
          downloadedThisSession += chunk.length;
          fileStream.write(chunk);

          // 计算进度
          if (onProgress && totalSize > 0) {
            const totalDownloaded = isResume ? (startPosition + downloadedThisSession) : downloadedThisSession;
            const percent = Math.round((totalDownloaded / totalSize) * 100);
            onProgress(percent, totalDownloaded, totalSize);
          }
        });

        res.on('end', () => {
          fileStream.end();

          // 如果使用了临时文件，重命名为最终文件名
          if (writePath === tempPath) {
            try {
              // 确保目标文件不存在
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.renameSync(tempPath, destPath);
            } catch (e) {
              console.error('重命名临时文件失败:', e);
            }
          }

          resolve({
            success: true,
            path: destPath,
            resumed: isResume
          });
        });

        res.on('error', (err) => {
          fileStream.end();
          // 断点续传模式下，保留临时文件以便下次继续
          // 只有在非断点续传模式下才删除不完整的文件
          if (!useTempFile && !isResume && fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
          resolve({
            success: false,
            path: destPath,
            error: err
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          path: destPath,
          error: err
        });
      });

      req.on('timeout', () => {
        req.destroy();
        // 超时时不删除临时文件，保留已下载部分以便续传
        // 只删除直接写入目标文件的情况
        if (!useTempFile && fs.existsSync(destPath)) {
          // 保留部分文件，不删除
        }
        resolve({
          success: false,
          path: destPath,
          error: new Error('Download timeout')
        });
      });

      req.end();
    });
  }

  /**
   * 下载 ECDICT 词典
   * @param {Function} onProgress 进度回调函数 (percent, downloaded, total)
   * @returns {Promise<{success: boolean, path: string, error?: Error}>}
   */
  async downloadEcdict(onProgress) {
    return this.downloadFile(ECDICT_URL, ECDICT_FILENAME, onProgress);
  }

  /**
   * 下载 CC-CEDICT 词典
   * @param {Function} onProgress 进度回调函数 (percent, downloaded, total)
   * @returns {Promise<{success: boolean, path: string, error?: Error}>}
   */
  async downloadCccedict(onProgress) {
    return this.downloadFile(CCCEDICT_URL, CCCEDICT_FILENAME, onProgress);
  }

  /**
   * 下载所有词典
   * @param {Function} onProgress 进度回调函数，接收两个参数：
   *   - progress: { dict: string, percent: number, downloaded: number, total: number }
   *   - phase: 'downloading' | 'completed' | 'error'
   * @returns {Promise<{success: boolean, results: Array, error?: Error}>}
   */
  async downloadAll(onProgress) {
    const results = [];

    // 下载 ECDICT
    const ecdictResult = await this.downloadEcdict((percent, downloaded, total) => {
      if (onProgress) {
        onProgress({
          dict: 'ecdict',
          percent,
          downloaded,
          total
        }, 'downloading');
      }
    });

    results.push({ dict: 'ecdict', ...ecdictResult });

    if (!ecdictResult.success) {
      return {
        success: false,
        results,
        error: ecdictResult.error
      };
    }

    // 下载 CC-CEDICT
    const cccedictResult = await this.downloadCccedict((percent, downloaded, total) => {
      if (onProgress) {
        onProgress({
          dict: 'cccedict',
          percent,
          downloaded,
          total
        }, 'downloading');
      }
    });

    results.push({ dict: 'cccedict', ...cccedictResult });

    if (!cccedictResult.success) {
      return {
        success: false,
        results,
        error: cccedictResult.error
      };
    }

    return {
      success: true,
      results
    };
  }

  /**
   * 获取下载状态
   * @param {string} filename 文件名
   * @returns {{status: 'none' | 'downloading' | 'completed', progress: number, downloaded: number, total: number}}
   */
  getDownloadStatus(filename) {
    const destPath = path.join(this.destDir, filename);
    const tempPath = destPath + TEMP_SUFFIX;

    // 检查最终文件是否存在
    if (fs.existsSync(destPath)) {
      const size = this._getExistingFileSize(destPath);
      return {
        status: 'completed',
        progress: 100,
        downloaded: size,
        total: size
      };
    }

    // 检查临时文件是否存在
    if (fs.existsSync(tempPath)) {
      const downloaded = this._getExistingFileSize(tempPath);
      return {
        status: 'downloading',
        progress: 0, // 无法知道总大小
        downloaded,
        total: 0
      };
    }

    return {
      status: 'none',
      progress: 0,
      downloaded: 0,
      total: 0
    };
  }

  /**
   * 清理临时文件
   * @param {string} filename 文件名，不传则清理所有临时文件
   */
  cleanupTempFile(filename) {
    if (filename) {
      const tempPath = path.join(this.destDir, filename + TEMP_SUFFIX);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`已清理临时文件: ${tempPath}`);
      }
    } else {
      // 清理所有临时文件
      const files = fs.readdirSync(this.destDir);
      files.forEach(file => {
        if (file.endsWith(TEMP_SUFFIX)) {
          const tempPath = path.join(this.destDir, file);
          fs.unlinkSync(tempPath);
          console.log(`已清理临时文件: ${tempPath}`);
        }
      });
    }
  }
}

module.exports = {
  DictDownloader,
  formatBytes,
  TEMP_SUFFIX
};
