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
- **增加列表项**：在 `BackendManager.queryImage` 回调后，解析返回的结构化字符串（如包含 `SOURCE:` 和 `TARGET:`）。
- **UI 呈现**：在 uTools 搜索列表增加一条独立 Item 展示提取出的原文，方便用户核对。

### 2.2 进阶翻译中心增强 (Advanced Center)
- **页签切换**：侧边栏增加 `ocr` 任务视图。
- **自动检测逻辑**：进入页签即读取 `utools.readImage()`。
- **Prompt 系统**：
  - 更新 `PromptManager` 为 `SOURCE:` / `TARGET:` 结构。
- **交互逻辑**：
  - **初次渲染**：展示图片 + 填充 OCR 与 译文。
  - **二次修正**：修改 OCR 框文本后，点击“执行重译”仅触发传统文本翻译。

## 3. 设计原则
- **简洁优先**：三段式垂直布局最大化空间利用。
- **一致性**：视觉风格与现有功能对齐。
- **高响应性**：剪贴板自动同步 + 重译降级缓存。
