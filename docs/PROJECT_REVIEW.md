# 项目检查与模块化说明

## 本次检查结论

项目整体是一个“Python 后端服务 + 静态 Web 控制台 + CLI”的本地工具。后端已经有较好的分层基础，主要问题集中在前端：

- 根目录 `app.js` 超过 1000 行，混合了常量、数据源、指标计算、Canvas 绘制、聊天、提醒、设置和事件绑定。
- 前端存在运行时问题：调用了未定义的 `detectMarketIntentSafe`。
- `src/ai_trader/index.html` 是旧版聊天页，仍调用旧接口 `/chat`，当前后端实际接口是 `/api/chat`。
- `src/ai_trader/Biclock.py` 只是旧提醒别名，没有被项目引用。
- `__pycache__` 属于运行缓存，不应该保留在项目代码中。
- 根目录 README 有编码显示问题，且仍提示直接打开根目录 `index.html`，与模块化 Web 入口不一致。

## 已完成的模块化

### 后端静态资源入口

`src/ai_trader/api.py` 现在统一从 `src/ai_trader/web/` 提供 Web UI：

- `/` 返回 `src/ai_trader/web/index.html`
- `/assets/*` 返回包内静态资源
- `/app.js` 与 `/styles.css` 保留兼容路由，但实际指向新模块入口与样式

这样 Web 资源和 Python 包在同一个业务目录内，部署、审查和后续维护都更清晰。

### 前端模块

旧的单文件脚本已经拆成以下模块：

- `constants.js`：资产、周期、默认设置、模型权重和市场意图关键词
- `i18n.js`：中英文文案和翻译函数
- `state.js`：运行时状态、设置读取与持久化
- `dom.js`：DOM 查询和元素索引
- `api.js`：后端 API 请求与外部 JSON 请求
- `providers.js`：真实数据源、模拟数据源、自定义 API 数据归一化
- `analysis.js`：均线、K 线结构、链上评分、衍生品评分、综合决策
- `render.js`：Canvas K 线、表格、指标、连接状态和市场快照渲染
- `assistant.js`：市场意图识别、聊天请求、Markdown 渲染、本地兜底回复
- `alarms.js`：提醒列表、创建提醒、取消提醒
- `settings.js`：设置表单、语言切换、模型设置保存、健康检查
- `main.js`：应用启动、事件绑定、自动刷新

模块边界按“数据 -> 分析 -> 渲染 -> 交互”分开，后续新增功能时可以减少对其他模块的影响。

## 已删除的无用内容

- `app.js`：已由 `src/ai_trader/web/js/*` 取代。
- `index.html`：已由 `src/ai_trader/web/index.html` 取代。
- `styles.css`：已由 `src/ai_trader/web/styles.css` 取代。
- `src/ai_trader/index.html`：旧版聊天页，接口过期且未被挂载。
- `src/ai_trader/Biclock.py`：未引用的旧别名文件。
- `__pycache__/`：Python 运行缓存。

## 当前核心调用链

### Web 启动链路

1. 用户运行 `python run_web.py`。
2. Uvicorn 加载 `ai_trader.api:app`。
3. FastAPI 创建 `AssistantService(prompt_for_key=False)`。
4. 浏览器访问 `/`，加载 `src/ai_trader/web/index.html`。
5. 页面通过 `/assets/js/main.js` 启动前端应用。
6. 前端并行加载行情、链上、衍生品数据，失败时自动使用本地模拟数据。
7. 聊天、提醒和模型设置通过 `/api/*` 调后端。

### CLI 启动链路

1. 用户运行 `python run.py`。
2. `TradingAssistant` 创建 `AssistantService(prompt_for_key=True)`。
3. CLI 输入进入 `service.chat()`。
4. 服务层优先解析提醒命令；否则按 LLM 配置决定聊天或市场分析。

## 后端模块职责

- `service.py` 是业务中枢，CLI 和 Web 都通过它访问分析、聊天、提醒和模型切换。
- `api.py` 只负责 HTTP 入参、出参和错误码转换。
- `data_fetch.py` 只负责 Binance 公共接口请求与数据转换。
- `analysis.py` 只负责后端市场快照和技术指标聚合。
- `ai.py` 只负责 LLM 调用、意图分类和 LLM 错误兜底。
- `alarm.py` 管理提醒状态和后台轮询。
- `parsing.py` 负责从自然语言中提取币种、周期和提醒指令。
- `tools.py` 暴露结构化工具调用，便于后续接入 Agent 或自动化。

## 仍建议后续处理

- 给 `parse_user_input()` 与 `parse_alarm_command()` 增加单元测试。
- 给前端 `analysis.js` 的评分规则增加样例测试，避免调参时破坏旧行为。
- 后端请求 Binance 当前是同步 requests；如果 Web 负载变大，可以改成异步请求或增加缓存。
- 提醒轮询当前在内存中维护，重启会丢失；长期运行可接 SQLite。
- 自定义数据源 URL 和浏览器端 API Key 适合本地使用，生产环境应改为服务端代理。
