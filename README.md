# AI Market Sentinel

AI Market Sentinel 是一个本地运行的加密市场监控与 AI 辅助分析工具，包含：

- 多周期 K 线结构分析：`15m / 1h / 4h / 1d / 1w / 1M`
- 链上压力与情绪指标：净流入/流出、活跃地址、巨鲸、MVRV、SOPR
- 衍生品风险指标：资金费率、多空比、爆仓、未平仓
- AI 聊天与市场分析：支持 OpenAI / DeepSeek 兼容接口
- 价格提醒：后端轮询价格并维护提醒状态
- Web 控制台：模块化前端，支持真实数据源与本地模拟数据自动降级

> 本项目是监控与研究工具，不构成投资建议。

## 目录结构

```text
.
├── run.py                         # CLI 入口
├── run_web.py                     # Web 服务入口
├── src/
│   ├── api.py                     # 兼容 uvicorn src.api:app
│   └── ai_trader/
│       ├── api.py                 # FastAPI 路由与静态资源挂载
│       ├── service.py             # CLI 与 Web 共用业务服务层
│       ├── data_fetch.py          # Binance 行情/衍生品数据
│       ├── analysis.py            # 后端市场快照与指标聚合
│       ├── ai.py                  # LLM 调用与错误兜底
│       ├── alarm.py               # 价格提醒管理器
│       ├── parsing.py             # 自然语言解析
│       ├── tools.py               # 结构化工具调用
│       └── web/
│           ├── index.html
│           ├── styles.css
│           └── js/                # 前端模块
└── docs/
    ├── DEVELOPER.md
    └── PROJECT_REVIEW.md
```

## 安装

```bash
pip install -r requirements.txt
```

## 启动

### Web UI

```bash
python run_web.py
```

打开 `http://127.0.0.1:8000`。

### CLI

```bash
python run.py
```

## 配置

`config.json` 只保存模型服务商与默认模型：

```json
{
  "provider": "deepseek",
  "default_model": "deepseek-chat"
}
```

LLM API Key 不写入 `config.json`：

- Web 设置页提交的 Key 只保存在当前后端进程内存。
- 也可以使用环境变量：`OPENAI_API_KEY` / `DEEPSEEK_API_KEY`。
- 数据源 API Key 保存在浏览器 `localStorage`，仅用于用户配置的自定义数据 URL。

## API

- `GET /api/health`
- `GET /api/market?symbol=BTCUSDT&timeframe=1h`
- `POST /api/analyze`
- `POST /api/chat`
- `GET /api/alarms`
- `POST /api/alarms`
- `DELETE /api/alarms/{alarm_id}`
- `GET /api/tools`
- `POST /api/tools/run`
- `POST /api/settings/model`

## 前端模块

- `constants.js`：资产配置、周期配置、默认设置、模型权重
- `i18n.js`：中英文文案
- `state.js`：运行时状态与浏览器设置持久化
- `api.js`：后端 API 与外部 JSON 请求
- `providers.js`：真实数据源、模拟数据源、自定义数据归一化
- `analysis.js`：K 线分析、链上评分、衍生品评分、综合决策
- `render.js`：Canvas 图表、表格、指标、连接状态渲染
- `assistant.js`：聊天、Markdown 渲染、本地兜底回复
- `alarms.js`：提醒列表、创建、取消
- `settings.js`：设置页、语言切换、健康检查
- `main.js`：应用启动、事件绑定、自动刷新

## 风险提示

上线前仍建议补齐：服务端代理、API Key 加密存储、数据校验、回测、告警节流、权限管理、审计日志和自动化测试。
