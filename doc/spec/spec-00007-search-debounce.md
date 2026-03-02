# Search 防抖与翻译进度提示设计方案

## 1. 需求背景 (Background)
目前 `preload.js` 中的 `search` 钩子会在每次用户敲击输入框或输入产生变更时**被实时调用**。但由于引入了 `@xenova/transformers` 的本地深度学习大模型，每一次查询推理都需要消耗巨大的算例与时间（尤其在非活跃环境、单核甚至冷启动的情况下）。
如果缺乏限制，连续的打字操作会瞬间堆积大量的模型调用，挤占系统资源，甚至引发 Node.js / WASM 内核超时崩溃。

同时，用户在等待高延迟的本地翻译时界面没有任何反馈反馈，容易让用户以为插件卡死。

目标：
1. **防止频繁触发**：通过引入防抖（Debounce）拦截高频按键。
2. **显示加载中状态**：调用模型预测时，呈现明显的后台等待/加载回写UI状态。 
3. **性能耗时统计**：当成功返回结果后，直观展示这次本地推理的耗时（毫秒/秒）。

## 2. 设计方案 (Design)

### 2.1 引入查词防抖（Debounce）
在 `preload.js` 内部建立一个闭包作用域的计时器引用 `searchTimeout`。
1. 当用户快速连续输入时，每次触发 `search` 时我们都拦截并销毁上一次未执行的查询 (`clearTimeout(searchTimeout)`)。
2. 设置合理的防抖等待时间 **`DEBOUNCE_DELAY` (建议 500 ~ 800 ms)**。只有当用户停顿输入超过该阈值时，才会真正触发一次向大模型的 `backend.queryWord` 请求。

### 2.2 响应式“加载中”提示 (Loading Indicator)
因 uTools 单纯基于 List（列表模式）呈现界面，无原生独立加载条遮罩。
我们在真正要发起大模型推理前，主动回调一次 `callbackSetList` 给出正在加载的虚假条目。
条目格式参考：
```javascript
callbackSetList([
    { title: '⏳ 正在拼命翻译中...', description: '本地大模型正在全负荷运行，请稍候...' }
]);
```
用户在停顿打字后能立刻看到该提示，理解系统处于正常运作中。

### 2.3 耗时反馈（Execution Timer）
计算实际传递给 WASM 模型的耗时。
1. 在向大模型发送请求 `backend.queryWord()` 的上一刻记录时间点 `startTime = Date.now()`。
2. 在大模型返回 callback 的下一刻计算时间差 `const costTime = Date.now() - startTime`。
3. 修改组装结果集 `buildListItems` 的传参，将 `costTime` 插入。
4. 结果包装时，在 `description` 后面附加类似 `(耗时: 1.25s)` 的标注戳，让用户明确知悉由于本地运算造成的等待是合理的。

## 3. 具体修改模块 (Modifications)
涉及修改的核心文件为：`preload.js`。

### 核心伪代码
```javascript
let searchTimeout = null;
const DEBOUNCE_DELAY = 600; // 防抖时间(毫秒)

// ... 其他代码

search: function (action, searchWord, callbackSetList) {
    // 每次发生按键事件，立刻清空上一轮计划中的翻译
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }

    if (!searchWord || !searchWord.trim()) {
        callbackSetList([]);
        return;
    }
    
    const w = searchWord.trim();

    // 重新开启计时
    searchTimeout = setTimeout(() => {
        // --- 1. 触发查询前，UI 置为加载状态 ---
        callbackSetList([
            { title: '⏳ 正在翻译中...', description: '由于调用本地模型，可能需要几秒钟，请稍候...' }
        ]);

        const sourceLang = isLikelyChinese(w) ? 'zh' : 'en';
        const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
        const isZhToEn = sourceLang === 'zh' && targetLang === 'en';
        
        // --- 2. 统计开始时间 ---
        const startTime = Date.now();
        
        backend.queryWord(w, sourceLang, targetLang, function (err, result) {
            // --- 3. 统计实际结束时间 ---
            const costMs = Date.now() - startTime;
            
            // 将耗时结果附带包装进去覆盖之前的加载状态
            callbackSetList(buildListItems(w, result || { found: false }, isZhToEn, costMs));
        });
    }, DEBOUNCE_DELAY);
}
```

针对 `buildListItems` 方法进行微调，接受新参数 `costMs`，并在返回列表项的 `description` 后拼接耗时信息即可。