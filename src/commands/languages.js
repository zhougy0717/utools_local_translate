/**
 * 该文件包含了 LibreTranslate 官方支持的语言列表
 * 自动生成的中文映射增强版
 */
const SUPPORTED_LANGUAGES = [
    { "code": "auto", "name": "自动推断 (反向翻译)", "desc": "根据输入内容自动判断 (中翻英 / 英翻中)" },
    { "code": "en", "name": "英语 (English)", "desc": "强制翻译为 英语" },
    { "code": "zh", "name": "简体中文 (Chinese)", "desc": "强制翻译为 简体中文" },
    { "code": "ar", "name": "阿拉伯语 (Arabic)", "desc": "强制翻译为 阿拉伯语" },
    { "code": "az", "name": "阿塞拜疆语 (Azerbaijani)", "desc": "强制翻译为 阿塞拜疆语" },
    { "code": "bg", "name": "保加利亚语 (Bulgarian)", "desc": "强制翻译为 保加利亚语" },
    { "code": "bn", "name": "孟加拉语 (Bengali)", "desc": "强制翻译为 孟加拉语" },
    { "code": "ca", "name": "加泰罗尼亚语 (Catalan)", "desc": "强制翻译为 加泰罗尼亚语" },
    { "code": "cs", "name": "捷克语 (Czech)", "desc": "强制翻译为 捷克语" },
    { "code": "da", "name": "丹麦语 (Danish)", "desc": "强制翻译为 丹麦语" },
    { "code": "de", "name": "德语 (German)", "desc": "强制翻译为 德语" },
    { "code": "el", "name": "希腊语 (Greek)", "desc": "强制翻译为 希腊语" },
    { "code": "eo", "name": "世界语 (Esperanto)", "desc": "强制翻译为 世界语" },
    { "code": "es", "name": "西班牙语 (Spanish)", "desc": "强制翻译为 西班牙语" },
    { "code": "et", "name": "爱沙尼亚语 (Estonian)", "desc": "强制翻译为 爱沙尼亚语" },
    { "code": "fa", "name": "波斯语 (Persian)", "desc": "强制翻译为 波斯语" },
    { "code": "fi", "name": "芬兰语 (Finnish)", "desc": "强制翻译为 芬兰语" },
    { "code": "fr", "name": "法语 (French)", "desc": "强制翻译为 法语" },
    { "code": "ga", "name": "爱尔兰语 (Irish)", "desc": "强制翻译为 爱尔兰语" },
    { "code": "he", "name": "希伯来语 (Hebrew)", "desc": "强制翻译为 希伯来语" },
    { "code": "hi", "name": "印地语 (Hindi)", "desc": "强制翻译为 印地语" },
    { "code": "hu", "name": "匈牙利语 (Hungarian)", "desc": "强制翻译为 匈牙利语" },
    { "code": "id", "name": "印尼语 (Indonesian)", "desc": "强制翻译为 印尼语" },
    { "code": "it", "name": "意大利语 (Italian)", "desc": "强制翻译为 意大利语" },
    { "code": "ja", "name": "日语 (Japanese)", "desc": "强制翻译为 日语" },
    { "code": "ko", "name": "韩语 (Korean)", "desc": "强制翻译为 韩语" },
    { "code": "lt", "name": "立陶宛语 (Lithuanian)", "desc": "强制翻译为 立陶宛语" },
    { "code": "lv", "name": "拉脱维亚语 (Latvian)", "desc": "强制翻译为 拉脱维亚语" },
    { "code": "ms", "name": "马来语 (Malay)", "desc": "强制翻译为 马来语" },
    { "code": "nb", "name": "挪威语 (Norwegian Bokmål)", "desc": "强制翻译为 挪威语" },
    { "code": "nl", "name": "荷兰语 (Dutch)", "desc": "强制翻译为 荷兰语" },
    { "code": "pl", "name": "波兰语 (Polish)", "desc": "强制翻译为 波兰语" },
    { "code": "pt", "name": "葡萄牙语 (Portuguese)", "desc": "强制翻译为 葡萄牙语" },
    { "code": "ro", "name": "罗马尼亚语 (Romanian)", "desc": "强制翻译为 罗马尼亚语" },
    { "code": "ru", "name": "俄语 (Russian)", "desc": "强制翻译为 俄语" },
    { "code": "sk", "name": "斯洛伐克语 (Slovak)", "desc": "强制翻译为 斯洛伐克语" },
    { "code": "sl", "name": "斯洛文尼亚语 (Slovenian)", "desc": "强制翻译为 斯洛文尼亚语" },
    { "code": "sq", "name": "阿尔巴尼亚语 (Albanian)", "desc": "强制翻译为 阿尔巴尼亚语" },
    { "code": "sv", "name": "瑞典语 (Swedish)", "desc": "强制翻译为 瑞典语" },
    { "code": "th", "name": "泰语 (Thai)", "desc": "强制翻译为 泰语" },
    { "code": "tl", "name": "塔加路语 (Tagalog)", "desc": "强制翻译为 塔加路语" },
    { "code": "tr", "name": "土耳其语 (Turkish)", "desc": "强制翻译为 土耳其语" },
    { "code": "uk", "name": "乌克兰语 (Ukrainian)", "desc": "强制翻译为 乌克兰语" },
    { "code": "vi", "name": "越南语 (Vietnamese)", "desc": "强制翻译为 越南语" }
];

/**
 * 根据语言代码获取显示名称
 * @param {string} code 
 * @returns {string}
 */
function getNameByCode(code) {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    if (!lang) return code;
    // 去掉中文名后的括号部分，例如 "英语 (English)" -> "英语"
    return lang.name.split(' (')[0];
}

module.exports = SUPPORTED_LANGUAGES;
module.exports.getNameByCode = getNameByCode;
