/**
 * 目标语种探测器 (TargetLanguageDetector)
 * 职责：实现“中英互译”建议算法。
 */
class TargetLanguageDetector {
    /**
     * 根据文本内容探测建议的源语言和目标语言
     * @param {string} text - 待判定文本
     * @returns {{source: string, target: string}}
     */
    detect(text) {
        if (!text || !text.trim()) {
            return { source: 'en', target: 'zh' }; // 默认
        }

        const isZh = this.isLikelyChinese(text);
        
        // 核心算法：含中翻英，不含中翻中
        return {
            source: isZh ? 'zh' : 'en',
            target: isZh ? 'en' : 'zh'
        };
    }

    /**
     * 检测文本是否包含中文字符
     * @param {string} text 
     * @returns {boolean}
     */
    isLikelyChinese(text) {
        if (!text) return false;
        // 使用 CJK 统一汉字范围：\u2E80-\u9FFF (覆盖部首、常用汉字等)
        return /[\u2E80-\u2EFF\u2F00-\u2FDF\u31C0-\u31EF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/.test(text);
    }
}

// 导出单例，节省实例化开销
module.exports = new TargetLanguageDetector();
