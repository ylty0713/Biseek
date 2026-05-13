# 开发文档：AI Trader（CLI + Web）

## 1. 项目目标
本项目是一个可扩展的加密交易助手，支持：
- 对话与行情分析（LLM）
- 市场指标与结构化快照
- 价格提醒（后台轮询，触发后更新状态）
- Web UI 可视化操作面板
- 工具化 API（便于后续让 AI 调更多外部能力）

## 2. 目录结构
- `run.py`：CLI 启动入口
- `run_web.py`：Web 服务启动入口
- `src/ai_trader/service.py`：统一业务服务层（CLI 与 Web 共用）
- `src/ai_trader/api.py`：FastAPI 接口
- `src/ai_trader/alarm.py`：提醒管理器（创建/轮询/取消/状态追踪）
- `src/ai_trader/data_fetch.py`：行情数据获取
- `src/ai_trader/analysis.py`：指标聚合与快照构建
- `src/ai_trader/ai.py`：LLM 调用与错误兜底
- `src/ai_trader/parsing.py`：自然语言解析（币种/周期/提醒指令）
- `src/ai_trader/tools.py`：工具注册与统一执行入口
- `src/ai_trader/web/index.html`：Web UI 页面入口
- `src/ai_trader/web/styles.css`：Web UI 样式
- `src/ai_trader/web/js/*`：前端模块，按常量、状态、数据源、分析、渲染、聊天、提醒和设置拆分

## 3. 安装依赖
```bash
pip install -r requirements.txt
```

## 4. 启动方式
### 4.1 CLI
```bash
python run.py
```

### 4.2 Web UI
```bash
python run_web.py
```
打开 `http://127.0.0.1:8000`。

后端会从 `src/ai_trader/web/` 提供静态资源：
- `/` -> `index.html`
- `/assets/styles.css`
- `/assets/js/main.js` 及其他 ES module

## 5. 配置说明
配置文件：`config.json`
关键字段：
- `provider`：`openai` 或 `deepseek`
- `default_model`：模型名

LLM API Key 不再写入 `config.json`。Web 设置页提交的 Key 只保存在当前后端进程内存；生产或长期运行建议使用环境变量。

也支持环境变量读取：
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`

## 6. API 概览
- `GET /api/health`：服务状态
- `GET /api/market?symbol=BTCUSDT&timeframe=1h`：市场快照
- `POST /api/analyze`：结构化分析 + LLM 解读
- `POST /api/chat`：聊天入口（可识别提醒命令）
- `GET /api/alarms`：提醒列表
- `POST /api/alarms`：创建提醒
- `DELETE /api/alarms/{alarm_id}`：取消提醒
- `GET /api/tools`：可调用工具列表
- `POST /api/tools/run`：执行工具
- `POST /api/settings/model`：更新模型设置

## 7. 提醒语义示例
- `帮我设置比特币价格超过71000时的提醒`
- `alert eth below 3000`

解析结果会映射为：
- symbol：`BTCUSDT`/`ETHUSDT` 等
- direction：`up`(>=) 或 `down`(<=)
- price：目标价格

## 8. 稳定性设计
- LLM 调用错误（连接失败、限流、API 报错）统一转为可读提示，不会让进程崩溃。
- 市场数据请求失败会抛出业务错误并在 API 返回 502。
- 提醒采用后台线程 + 状态机（`active/triggered/cancelled/error`）。

## 9. 二次开发建议
1. 在 `tools.py` 新增工具并暴露给 `/api/tools/run`。
2. 在 `service.py` 聚合新数据源（链上、订单簿、新闻）。
3. 在前端 `src/ai_trader/web/js/` 新增独立模块，并从 `main.js` 绑定入口。
4. 为 `parsing.py` 加更丰富的中文自然语言规则。
