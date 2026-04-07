# 进阶翻译中心：图片翻译功能设计规约 (2026-04-07)

## 0. 背景与目标
在目前的“查词”核心功能基础上，为“进阶翻译”增加“图片翻译”页签。该功能旨在提供比简单列表翻译更深度的工作流：**视觉识别 -> 源码精修 -> AI 重译 -> 复制利用**。

## 1. 界面原型 (Demo)

以下为“图片翻译”页签激活后的布局示意：

```html
<div class="ocr-workflow-container" style="display:flex; flex-direction:column; gap:12px; height:100%; padding:10px; font-family: -apple-system, system-ui, sans-serif;">
  
  <!-- 1. 翻译结果 (顶部) -->
  <div class="pane result-pane">
    <label style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">最终译文 (AI 生成)</label>
    <div id="ocr-translation-result" style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; padding:12px; min-height:80px; font-size:14px; line-height:1.6;">
       <!-- 动态填入译文 -->
       The quick brown fox jumps over the lazy dog.
    </div>
  </div>

  <!-- 2. 识别结果 (中部，可编辑) -->
  <div class="pane source-pane">
    <label style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">OCR 识别出的原文 (可手动修正)</label>
    <textarea id="ocr-source-input" style="height:100px; width:100%; padding:12px; box-sizing:border-box; border-radius:6px; border:1px solid #e2e8f0; font-size:14px; resize:none;" placeholder="AI 正在识图中...">敏捷的棕色狐狸跳过了那条懒狗。</textarea>
    <div style="display:flex; justify-content:flex-end; margin-top:5px;">
       <button class="btn-execute" style="background:#2563eb; color:white; border:none; padding:4px 12px; border-radius:4px; font-size:12px; cursor:pointer;">执行重译</button>
    </div>
  </div>

  <!-- 3. 原图片预览 (底部) -->
  <div class="pane image-pane">
    <label style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">原图参考 (剪贴板图片)</label>
    <div id="ocr-image-preview" style="height:120px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
       <div style="width: 80%; height: 80%; background: #ccc; border-radius: 4px; display:flex; align-items:center; justify-content:center; color: #666;">[缩略图预览区]</div>
    </div>
  </div>

</div>
```

## 2. 详细设计逻辑

### 2.1 快速翻译增强 (Preload List)
- **逻辑变化**：在 `BackendManager.queryImage` 回调后，解析返回的结构化字符串（如包含 `SOURCE:` 和 `TARGET:`）。
- **UI 变化**：在 `ViewPresenter.buildResultItems` 中增加逻辑，如果结果包含“原文提取内容”，则为其创建一个独立的列表项，位于翻译结果下方。

### 2.2 进阶翻译中心增强 (Advanced Center)
- **页签切换**：侧边栏增加 `ocr` task 类型。
- **自动检测逻辑** (Renderer 层)：
  - 进入 `ocr` 页签时，调用 `utools.readImage()`。
  - 若有图片，将其转换为 DataURL 并显示在底部预览区。
  - 自动向 Bridge 发起 `ocrTranslate` 请求。
- **Prompt 系统**：
  - 更新 `PromptManager` 的 `vision` 模板，要求模型按以下格式输出：
    ```text
    SOURCE:
    [图片内文字原文]
    TARGET:
    [翻译后的文字]
    ```
- **手动纠偏交互**：用户在“中部识别框”修改完文字后，点击“执行重译”，由于此时已经存在文字原文，逻辑将降级为 `advanced` (纯文本翻译)，不再重新执行耗时的 Vision 任务，而是直接利用普通翻译模型（或同一模型普通 Chat 接口）刷新“顶部结果”。

## 3. 核心设计要点
- **简洁优先**：三段式垂直布局最大化利用了纵向空间。
- **一致性**：保持与“变量命名”和“进阶翻译”相似的视觉风格。
- **可纠错性**：强调用户对识别结果的控制权。
