# 开发文档：AI 智能交易助手

## 项目结构
- `src/ai_trader/config.py`：配置读写、默认模型与 API Key 管理。
- `src/ai_trader/model_factory.py`：模型选择（交互式）与 OpenAI/DeepSeek 客户端初始化。
- `src/ai_trader/prompts.py`：提示词模板（分类器、闲聊、交易分析）。
- `src/ai_trader/parsing.py`：用户输入解析（币种、周期、意图偏好）。
- `src/ai_trader/data_fetch.py`：行情、资金费率、持仓量、爆仓单数据获取（Binance REST）。
- `src/ai_trader/indicators.py`：EMA/RSI/MACD 等指标计算。
- `src/ai_trader/analysis.py`：支撑阻力、趋势结构、多周期/单周期分析、爆仓聚类。
- `src/ai_trader/ai.py`：LLM 调用封装（意图分类、闲聊、交易解读）。
- `src/ai_trader/utils.py`：通用小工具（去重等）。
- `src/ai_trader/main.py`：CLI 入口，串联配置、LLM、数据抓取与输出。

## 安装依赖
```bash
pip install -r requirements.txt
```
若无 `requirements.txt`，按需安装：`openai`, `python-dotenv`, `pandas`, `requests`, `binance-connector`（或 `python-binance`）。

## 运行
```bash
python run.py
```
首次运行会提示选择模型并输入对应的 API Key，信息保存在工作目录下的 `config.json`。

## 开发约定
- **可测试性**：交互函数接收 `prompt_fn` 以便单元测试模拟输入。
- **无崩溃原则**：配置读取、外部请求异常时返回安全默认值，避免进程退出。
- **模块职责清晰**：新增功能尽量按“数据获取 / 指标 / 分析 / LLM / 配置”的分层扩展。

## 扩展指南
1. **新增交易所数据源**：在 `data_fetch.py` 增加函数并在 `_analyze_entry` 中选择性使用；保持返回 `DataFrame` 以复用指标/分析。
2. **新增技术指标**：在 `indicators.py` 扩展函数，确保不修改原始 `df` 引用或先 `df.copy()`。
3. **策略或风险模块**：在 `analysis.py` 添加新的解析函数，或新增 `strategies.py` 供 LLM 调用。
4. **更多工具调用**：在 `ai.py` 里为模型增加函数式“工具”包装，再在 `prompts.py` 里提供调用格式。
5. **配置项**：在 `config.py` 添加 getter/setter，默认值写在模块顶部常量里。

## 测试建议
- 为解析、指标计算等纯函数编写单测：使用 `pytest`，对固定数据帧校验输出。
- 对 LLM 相关函数可用假客户端或 `responses` 库做接口桩。

## 未来路线
- 增加 Web UI（FastAPI + React/Vite），后台复用 `TradingAssistant`。
- 引入任务队列（Celery/RQ）做定时推送。
- 支持回测模块，复用 `data_fetch` + `indicators`。
- 加入风控：最大回撤、仓位管理提示。

## 常见问题
- **卡在选择模型**：检查终端是否支持交互；或在 `config.json` 直接写入 `provider` 与 `default_model`。
- **网络超时**：`data_fetch` 默认 10s 超时，可根据需要调大；若需代理，可在外部设置 `HTTP(S)_PROXY` 环境变量。
- **编码乱码**：文件统一 UTF-8；若 Windows 终端显示异常，运行 `chcp 65001`。
