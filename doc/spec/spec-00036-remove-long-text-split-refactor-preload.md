# Spec-00036: 删除长文本拆分逻辑并重构清理入口 (Remove long text split & Refactor entry)

## 1. 背景与目标
在版本早期，为了解决 uTools 列表模式单行显示的限制，我们引入了 `splitTextToLines` 逻辑，将长段落翻译结果拆分为多条列表项以实现一种“伪翻页”滚动体验（参考 `Spec-00025`）。

随着 **Ollama 进阶翻译中心 (Advanced Translation Center)** 的引入（参考 `Spec-00035`），用户已经拥有了处理长文本、富文本和复杂语境的专用页面。因此，主列表中的“长文本拆分”逻辑现已变得冗余且增加了视图层复杂度。

**本次重构的目标：**
1. 移除 `src/utils/text_utils.js` 中复杂的切分算法。
2. 简化 `src/utils/view_presenter.js` 的列表生成逻辑，回归“一词一译”的简洁展示。
3. 对 `preload.js` 进行结构化审计与清理，放宽物理上限并移除过时代码。

## 2. 详细设计 (Detailed Design)

### 2.1 物理上限调整 (Thresholds)
在 `preload.js` 中，将 `MAX_SELECTION_LENGTH` 从 **200** 提升到 **5000**：
*   **理由**：200 字符限制了长段落通过超级面板直接查词。提升到 5000 字符可以确保大部分复杂段落能至少在主界面触发初步翻译，并弹出“进阶翻译”入口。
*   **安全防护**：保留 5000 字符上限，防止因极端文本输入导致的内存/后端奔溃。

### 2.2 视图层重构 (`src/utils/view_presenter.js`)
取消原有的 `for` 循环拆分推入逻辑。

**改造前 (伪代码)：**
```javascript
const translationLines = splitTextToLines(fullTranslationText, 80);
for (let line of translationLines) {
  list.push({ title: line, description: searchWord, copyText: fullTranslationText });
}
```

**改造后 (期望逻辑)：**
```javascript
list.push({
  title: fullTranslationText.trim(), // 由 uTools 自动处理单行截断
  description: searchWord.trim(),
  copyText: fullTranslationText // 保持完整文本供点击复制
});
```

### 2.3 工具类清理 (`src/utils/text_utils.js`)
*   **删除函数**：`splitTextToLines`, `tokenize`。
*   **保留函数**：`getCharWidth` (若仍有其他地方潜在引用，可保留作为纯工具类)。
*   **架构影响**：减少了 CPU 在展示阶段的计算量，规避了文本切分带来的边缘 UI 问题。

### 2.4 `preload.js` 入口清理
*   **移除过时标记**：删除顶部的 "Phase Zero Demo" 历史版本记录。
*   **逻辑优化**：
    *   在 `applyEnterWithWord` 开始处进行物理长度校验（5000字符）。
    *   移除针对过长文本返回 `false` 的逻辑阈值（现由 5000 接替）。

## 3. 技术实现 (Technical Details)

### 3.1 模块映射关系 (Module Changes)

| 文件路径 | 变更类型 | 核心变更点 |
| :--- | :--- | :--- |
| `src/utils/text_utils.js` | 瘦身 | 删除 `splitTextToLines` 算法 |
| `src/utils/view_presenter.js` | 简化 | 移除对 `text_utils.js` 的引用及拆分循环逻辑 |
| `preload.js` | 重构 | `MAX_SELECTION_LENGTH` (200 -> 5000)，移除冗余注释 |

### 3.2 交互示例
1.  用户搜索长语句（如 500 字）。
2.  主列表只显示 **1 条** 结果条目，`title` 显示截断后的翻译。
3.  点击该条目：获取 **完整 500 字** 译文。
4.  列表底部追加进阶入口：用户点击后在 Webview 中精修。

## 4. 单元测试关注点 (Testing)
1.  **最大限制验证**：输入 5001 字符，验证系统是否正确拦截或友好处理。
2.  **单条模式验证**：输入长自然段落，验证结果列表是否仅生成 1 条主译文条目（不包括耗时项和进阶入口）。
3.  **复制完整性验证**：在主列表单行点击时，验证剪贴板中是否为未截断的全文。

---
## 5. 结论
通过本次重构，插件将原本沉重的列表展示逻辑“外包”给更专业的进阶翻译中心，主界面得以回归轻量化的查词风格，极大提升了代码的可维护性。
