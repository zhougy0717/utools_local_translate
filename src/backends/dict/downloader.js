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

// ============================================================
// Gitee 分卷下载配置（spec-00024）
// 上传完成后手工填入以下字段：
//   baseUrl   — Gitee Release 或 Raw 直链前缀，末尾不含文件名，以 '/' 结尾
//               示例: 'https://gitee.com/user/repo/releases/download/v1.0.0/'
//   volumes   — 分卷总数（与 scripts/split_dict.py 生成的数量一致）
//   checksums — 每个分卷的 MD5（顺序与分卷序号对应，可从 checksum.json 复制）
// ============================================================
const GITEE_ECDICT_CONFIG = {
  baseUrl: 'https://gitee.com/benzhou-guangyu/utools_local_translate/releases/download/0.1/',
  volumes: 5,
  checksums: [
    'a4e362107154e08e1333ed659cf1d6f4',
    '2a123d9e476531eb57da022cce22fb6e',
    '59b18c385a335c1fba968c3d36153213',
    'd518c048fc286f1e028585114f5f9a11',
    '3b9bf147cf543afbdbc86093f3c1f828'
  ]
};

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
    this.sslVerify = options.sslVerify ?? false;
    this.agent = null;

    // 如果配置了代理，创建 Agent
    if (this.proxy) {
      try {
        if (this.proxy.startsWith('socks')) {
          const { SocksProxyAgent } = require('socks-proxy-agent');
          this.agent = new SocksProxyAgent(this.proxy);
        } else {
          this.agent = new HttpsProxyAgent(this.proxy, { rejectUnauthorized: !!this.sslVerify });
        }
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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        rejectUnauthorized: !!this.sslVerify
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
          fileStream.end(() => {
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
        });

        res.on('error', (err) => {
          fileStream.end(() => {
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
   * 下载 ECDICT 词典 (GitHub)
   * @param {Function} onProgress 进度回调函数 (percent, downloaded, total)
   * @returns {Promise<{success: boolean, path: string, error?: Error}>}
   */
  async downloadEcdict(onProgress) {
    const dbPath = path.join(this.destDir, 'ecdict.db');
    if (fs.existsSync(dbPath)) {
      if (onProgress) onProgress(100, 1, 1);
      return { success: true, path: dbPath, skipped: true };
    }
    return this.downloadFile(ECDICT_URL, ECDICT_FILENAME, onProgress);
  }

  /**
   * 从 Gitee 按序下载所有分卷 (spec-00024)
   *
   * 分卷文件命名规则: ecdict.zip.001, ecdict.zip.002, ...
   * 支持各分卷独立的断点续传（复用 downloadFile 内部的 TEMP_SUFFIX 机制）。
   *
   * @param {Object} [config] 分卷配置（默认使用 GITEE_ECDICT_CONFIG）
   * @param {string} config.baseUrl  Gitee 直链前缀，末尾含 '/'
   * @param {number} config.volumes  分卷总数
   * @param {string[]} config.checksums 每个分卷的期望 MD5（按序）
   * @param {Function} onProgress 进度回调 (percent, downloadedTotal, sizeTotal)
   * @returns {Promise<{success: boolean, paths: string[], error?: Error}>}
   */
  async downloadVolumes(config, onProgress) {
    const { baseUrl, volumes, checksums } = Object.assign({}, GITEE_ECDICT_CONFIG, config);

    if (!baseUrl || baseUrl.startsWith('YOUR_')) {
      return {
        success: false,
        paths: [],
        error: new Error('Gitee 下载链接尚未配置，请填写 downloader.js 中的 GITEE_ECDICT_CONFIG.baseUrl')
      };
    }

    const dbPath = path.join(this.destDir, 'ecdict.db');
    const zipPath = path.join(this.destDir, ECDICT_FILENAME);
    const mergedZipPath = path.join(this.destDir, 'ecdict_merged.zip');

    if (fs.existsSync(dbPath) || fs.existsSync(zipPath) || fs.existsSync(mergedZipPath)) {
      if (onProgress) onProgress(100, 1, 1);
      return { success: true, paths: [], skipped: true };
    }

    const paths = [];
    // 用于汇总进度的 sizes 缓存（各分卷已下载字节数）
    const sessionSizes = new Array(volumes).fill(0);
    // 先用 0 估算总量，待第一个分卷响应后再修正（Gitee 不一定返回 Content-Length）
    let knownTotal = 0;

    for (let i = 1; i <= volumes; i++) {
      const paddedIndex = String(i).padStart(3, '0');
      const filename = `ecdict.zip.${paddedIndex}`;
      const url = `${baseUrl}${filename}`;

      const result = await this.downloadFile(
        url,
        filename,
        (percent, downloaded, total) => {
          // 更新当前分卷的已下载量
          sessionSizes[i - 1] = downloaded;
          // 估算总进度
          if (total > 0) knownTotal = Math.max(knownTotal, total * volumes);
          const totalDownloaded = sessionSizes.reduce((a, b) => a + b, 0);
          const overallPercent = knownTotal > 0
            ? Math.min(Math.round((totalDownloaded / knownTotal) * 100), 99)
            : Math.round(((i - 1 + percent / 100) / volumes) * 100);

          if (onProgress) {
            onProgress(overallPercent, totalDownloaded, knownTotal);
          }
        }
      );

      if (!result.success) {
        return {
          success: false,
          paths,
          error: result.error || new Error(`分卷 ${filename} 下载失败`)
        };
      }

      paths.push(result.path);
    }

    if (onProgress) onProgress(100, knownTotal, knownTotal);

    return { success: true, paths };
  }

  /**
   * 下载 CC-CEDICT 词典
   * @param {Function} onProgress 进度回调函数 (percent, downloaded, total)
   * @returns {Promise<{success: boolean, path: string, error?: Error}>}
   */
  async downloadCccedict(onProgress) {
    const dbPath = path.join(this.destDir, 'cccedict.db');
    if (fs.existsSync(dbPath)) {
      if (onProgress) onProgress(100, 1, 1);
      return { success: true, path: dbPath, skipped: true };
    }
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
