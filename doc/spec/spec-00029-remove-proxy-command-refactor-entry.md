# SPEC-00029: 精简斜线命令 - 移除 /proxy 并重构为自治的代理服务

## 1. 背景与目标
为了提升系统的可维护性并解耦 UI 渲染与核心业务逻辑，我们将移除全局的 `/proxy` 斜线命令。同时，我们将代理配置入口整合至需要网络支持的“离线词典配置”界面中。通过基于事件驱动的重构，我们将实现后端模块对代理变更的自动感知，并使 `preload.js` 回归其作为“引导程序”的极简职责。

### 1.1 目标
- **去智化 `preload.js`**：取消其对具体 UI 面板的管理，仅负责初始化核心服务。
- **UI 整合**：在“离线词典配置”中提供代理配置入口。

<div style="border: 1px solid #e1e4e8; border-radius: 6px; padding: 16px; background-color: #ffffff; margin-bottom: 20px;">
  <h4 style="margin-top: 0; font-size: 14px; color: #586069;">UI 效果预览</h4>
  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; font-size: 13px; display: flex; gap: 10px; align-items: flex-start; color: #24292e;">
    <span style="font-size: 16px;">🌐</span>
    <div style="flex: 1;">
      <strong style="color: #0366d6; display: block; margin-bottom: 2px;">网络代理：</strong>
      <span>如遇下载缓慢或失败，请尝试 <a href="#" style="color: #166534; font-weight: 600; text-decoration: underline;">配置全局代理</a>。</span>
    </div>
  </div>
</div>

- **解耦重构**：代理配置界面的打开、关闭与重载逻辑由 `ProxyService` 自主管理，通过广播机制通知其他订阅者（如 `BackendManager`）。

## 2. 核心设计

### 2.1 架构模型 (Architecture)
我们将通过广播订阅模式确保各模块能够自愈地响应配置变更，剥离 `preload.js` 中的业务耦合。

```plantuml
@startuml
interface EventEmitter {
  +on(event, listener)
  +emit(event, ...args)
}

class CoreService {
  +init()
  +getProxyService(): ProxyService
}

class ProxyService {
  -uiContainer: DOMElement
  +openPanel()
  +closePanel()
  +saveProxyConfig()
}
EventEmitter <|-- ProxyService : 广播配置变更

class BackendManager {
  +init(config)
  +reload(newConfig)
  -onProxyChanged()
}

class DictBackend {
  +openProxyConfig()
  -proxyConfig
}

CoreService "1" *-- "1" ProxyService : 生命周期管理
Preload ..> CoreService : 1. 实例化核心服务
DictBackend ..> ProxyService : 2. 任务触发 (打开配置)
ProxyService ..> BackendManager : 3. 广播 (PROX_CONFIG_CHANGED)
@enduml
```

### 2.2 关键架构变更点：
1. **职责迁移**：原本在 `preload.js` 中的 `window.openProxyConfigPanel` 及相关 DOM 操作代码迁移至 `ProxyService` 类中，使代理功能实现“自描述、自管理”。
2. **引导程序简化**：`preload.js` 的 `select` 函数中不再包含任何打开代理界面的信号判断逻辑。
3. **事件驱动重载**：`BackendManager` 在初始化时向 `ProxyService` 订阅变更事件，从而在代理变更时自动触发全局 `reload()`，无需 `preload.js` 在回调中显式介入。

### 2.3 交互时序 (Sequence Diagram)
通过时序图可以明确 `preload.js` 在整个生命周期中仅在启动阶段参与，后续的 UI 挂载与业务重载均由服务组件自主完成。

```plantuml
@startuml
skinparam sequenceMessageAlign center

actor User
participant "DictRenderer (Iframe)" as UI_Dict
participant "DictBackend" as Dict
participant "ProxyService" as Proxy
participant "ProxyRenderer (Iframe)" as UI_Proxy
participant "BackendManager" as Manager

== 界面拉起 ==
User -> UI_Dict : 点击 "配置全局代理"
UI_Dict -> Dict : api.openProxyConfig()
Dict -> Proxy : openPanel()
Proxy -> Proxy : 挂载 Iframe 容器 (DOM 操作)
Proxy --> User : 显示代理配置界面

== 配置操作与广播 ==
User -> UI_Proxy : 修改并点击 "保存并测试"
UI_Proxy -> Proxy : saveProxyConfig(config)
Proxy -> Proxy : 持久化配置
Proxy -[#red]> Manager : [EVENT] PROX_CONFIG_CHANGED
Manager -> Manager : reload() : 自动感知并重构后端实例

== 界面关闭 ==
User -> UI_Proxy : 点击 "关闭"
UI_Proxy -> Proxy : closePanel()
Proxy -> Proxy : 卸载 Iframe 容器 (DOM 移除)
Proxy --> User : 返回词典配置页
@enduml
```

### 2.4 逻辑处理流
1. **引导初始化**：`preload.js` 启动 -> 调用 `coreService.init()` -> `ProxyService` 实例化。
2. **用户点击**：词典配置页点击链接 -> `_dictAPI.openProxyConfig()` (由 `DictBackend` 提供接口) -> 调用 `proxyService.openPanel()`。
3. **UI 渲染**：`ProxyService` 动态创建 iframe 容器并挂载至 `document.body`。
4. **配置保存**：用户在 Iframe 中保存配置 -> `ProxyService.saveProxyConfig()` 被触发 -> **广播 `PROXY_CONFIG_CHANGED` 事件**。
5. **系统重载**：`BackendManager` 监听到事件 -> 自动执行 `this.reload()` 刷新整个后端的代理环境。
6. **面板关闭**：调用 `proxyService.closePanel()` -> 清理 DOM，不涉及业务回调。

### 2.5 即时生效保障 (Hot-Reloading)
为确保用户在配置代理后能立即提升下载成功率，无需重启插件或重开下载面板：
1. **实例级监听**：`DictBackend` 实例在创建后会订阅 `ProxyService` 指送的 `PROX_CONFIG_CHANGED` 事件。
2. **状态同步**：收到事件后，`DictBackend` 将从 `appConfig` 获取最新代理，并调用其内部 `DictDownloader` 的配置更新接口。
3. **即时重用**：在下载过程中切换代理，后续的文件分卷请求将即刻使用新的 Proxy Agent，确保已失败的连接在重试时能享受新的网络通路。

## 3. 命令卸载
- **清理引用**：从 `src/commands/index.js` 移除 `proxyCommand` 注册。
- **物理删除**：逻辑迁移完成后，彻底删除 `src/commands/proxy.js`。

## 4. 测试重点
- [ ] 验证 `preload.js` 启动后是否有报错，是否符合极简化的要求。
- [ ] 验证点击词典下载页的代理链接，是否能正确触发 `ProxyService.openPanel()` 并显示界面。
- [ ] 验证代理面板关闭后，控制台是否能看到 `BackendManager` 触发的自动重载日志。
- [ ] 验证输入 `/` 后，建议列表中不再出现 `代理设置` 项。

## 4. 测试设计 (Test Design)

### 4.1 单元测试设计 (Unit Testing)
重构引入了事件驱动模式，重点关注核心组件的订阅与响应：
- **ProxyService 广播校验**：验证调用 `saveProxyConfig()` 或 `closePanel()` 时是否正确发出 `PROX_CONFIG_CHANGED` 事件。
- **BackendManager 自动重载**：模拟广播事件，验证 `BackendManager` 是否如预期地执行了 `reload()` 重新配置后端环境。
- **DictBackend 实例动态更新**：验证其内部 `DictDownloader` 是否成功接收广播并即时更新了其底层的代理 Proxy Agent，不中断正在查词或下载的句柄。

### 4.2 集成与回归测试 (Regression Testing)
- **UI 挂载与卸载**：验证 `ProxyService` 指送的 Iframe 挂载是否正常，样式是否符合 spec 预览，卸载后 DOM 节点是否被彻底移除。
- **配置一致性**：确认通过词库页修改的代理配置，在持久化存储中与 `/mode` 切换后的其他后端共享且有效。

## 6. preload.js 专项改造设计
为确保 `preload.js` 仅保留引导程序职责，以下列出该文件的改造清单：

### 6.1 当前现状 (Before)
- **UI 直接定义**：在顶层定义了 `window.openProxyConfigPanel` 和 `window._closeProxyConfigPanel`，包含具体的 DOM 创建和样式设置逻辑。
- **业务耦合**：在 `openProxyConfigPanel` 的回调中显式调用 `BackendManager.reload(backendConfig)`。
- **命令响应驱动**：在 `uTools.select` 周期内，专门处理 `itemData.isCommandContext` 中的 `openProxyConfigPanel` 信号。

### 6.2 确定删除项 (To De-Logic)
- **[Delete]** `window.openProxyConfigPanel`: 移除整段 DOM 挂载逻辑，该职责转移至 `ProxyService`。
- **[Delete]** `onCloseCallback` 生命周期传递：不再由 `preload.js` 在面板关闭时通知后端。
- **[Delete]** `select` 中的信号监听：移除 `if (signal.openProxyConfigPanel)` 逻辑块。因为 `/proxy` 命令已移除，此处的死代码将被清理。
- **[Delete]** 冗余清理逻辑：移除 `/mode` 切换时对 `window.hideProxyConfig` 的多余检查（交由 `ProxyService` 自行管理）。

### 6.3 最终保留职责 (After)
- **服务引导**：仅保留 `BackendManager.init()` 和 `coreService.init()` 的启动调用。
- **IPC 映射**：保留 uTools 规定的 `dict` 结构，负责将用户输入转发至 `CommandManager` 或 `BackendManager`。

## 7. 后续规划
- 在后续迭代中，计划为 **Ollama** 和 **LibreTranslate** 的配置界面添加类似的代理入口链接，确保各个后端都能方便地进行网络调试。
