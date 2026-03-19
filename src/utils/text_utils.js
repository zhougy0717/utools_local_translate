/**
 * 文本处理辅助工具
 */

/**
 * 获取字符的显示宽度权重
 * @param {string} char 
 * @returns {number} 全角/宽字符返回 2，半角返回 1
 */
function getCharWidth(char) {
  if (!char) return 0;
  return char.charCodeAt(0) > 255 ? 2 : 1;
}

/**
 * 将行文本拆分为“词”单元（Token）
 * CJK: 每个字符为一个词
 * 非CJK单词: 连续的非空格字符为一个词
 * 空格: 连续的空格为一个词
 */
function tokenize(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char.charCodeAt(0) > 255) {
      tokens.push({ text: char, width: 2 });
      i++;
    } else if (/\s/.test(char)) {
      let space = '';
      while (i < line.length && /\s/.test(line[i]) && line[i].charCodeAt(0) <= 255) {
        space += line[i];
        i++;
      }
      tokens.push({ text: space, width: space.length });
    } else {
      let word = '';
      while (i < line.length && line[i].charCodeAt(0) <= 255 && !/\s/.test(line[i])) {
        word += line[i];
        i++;
      }
      tokens.push({ text: word, width: word.length });
    }
  }
  return tokens;
}

/**
 * 将长文本按照指定的最大显示宽度切分为多行
 * 逻辑：保证单词完整性，采用贪婪包装算法 (Greedy Wrap)
 * @param {string} text 待处理长文本
 * @param {number} maxDisplayWidth 单行最大显示宽度权重，默认 80
 * @returns {string[]} 切分后的行数组
 */
function splitTextToLines(text, maxDisplayWidth = 80) {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const result = [];

  paragraphs.forEach((paragraph) => {
    const tokens = tokenize(paragraph);
    let currentLine = '';
    let currentWidth = 0;

    tokens.forEach((token) => {
      // 如果单词本身就超过了最大宽度，强制截断
      if (token.width > maxDisplayWidth) {
        // 先把当前行存了
        if (currentLine) {
          result.push(currentLine);
          currentLine = '';
          currentWidth = 0;
        }
        
        // 强制截断超长单词/占位符
        let tempText = token.text;
        while (tempText.length > 0) {
          let subLine = '';
          let subWidth = 0;
          let j = 0;
          while (j < tempText.length && subWidth + getCharWidth(tempText[j]) <= maxDisplayWidth) {
            subWidth += getCharWidth(tempText[j]);
            subLine += tempText[j];
            j++;
          }
          if (subLine) {
            result.push(subLine);
            tempText = tempText.substring(j);
          } else {
            // 防止死循环（理论上 getCharWidth 最小为 1，maxWidth 至少应大于 2）
            result.push(tempText);
            break;
          }
        }
        return;
      }

      // 正常贪婪包装逻辑
      if (currentWidth + token.width > maxDisplayWidth) {
        if (currentLine) {
          result.push(currentLine);
        }
        // 如果是行首空格，可以考虑剔除，但此处选择保留原始空格逻辑或简单处理
        currentLine = token.text;
        currentWidth = token.width;
      } else {
        currentLine += token.text;
        currentWidth += token.width;
      }
    });

    if (currentLine) {
      result.push(currentLine);
    }
  });

  return result;
}

module.exports = {
  getCharWidth,
  splitTextToLines
};
