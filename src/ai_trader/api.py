"""FastAPI app for AI trader web UI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .service import AssistantService
from .data_fetch import DataFetchError
from .tools import list_tools, run_tool

app = FastAPI(title="AI Trader API", version="1.0.0")
service = AssistantService(prompt_for_key=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_DIR = Path(__file__).resolve().parent / "web"
if WEB_DIR.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIR), name="assets")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] | None = None


class AnalyzeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    symbol: str | None = None
    timeframe: str | None = None


class AlarmRequest(BaseModel):
    symbol: str
    target_price: float
    direction: str = Field(pattern="^(up|down)$")


class ModelSettingsRequest(BaseModel):
    provider: str = Field(pattern="^(openai|deepseek)$")
    model: str
    api_key: str | None = None


class ToolRunRequest(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)


@app.get("/")
def home() -> FileResponse:
    index_path = WEB_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="UI files missing")
    return FileResponse(index_path)


@app.get("/app.js")
def dashboard_js() -> FileResponse:
    path = WEB_DIR / "js" / "main.js"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dashboard app missing")
    return FileResponse(path)


@app.get("/styles.css")
def dashboard_css() -> FileResponse:
    path = WEB_DIR / "styles.css"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dashboard styles missing")
    return FileResponse(path)


@app.get("/api/health")
def health() -> dict:
    return service.health()


@app.get("/api/market")
def market(symbol: str = "BTCUSDT", timeframe: str = "1h") -> dict:
    try:
        return service.market_overview(symbol.upper(), timeframe)
    except DataFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/analyze")
def analyze(payload: AnalyzeRequest) -> dict:
    try:
        return service.analyze(payload.query, payload.symbol, payload.timeframe)
    except DataFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/chat")
def chat(payload: ChatRequest) -> dict:
    try:
        return service.chat(payload.message, context=payload.context)
    except DataFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/alarms")
def list_alarms() -> dict:
    return {"items": service.list_alarms()}


@app.post("/api/alarms")
def create_alarm(payload: AlarmRequest) -> dict:
    item = service.create_alarm(payload.symbol.upper(), payload.target_price, payload.direction)
    return {"item": item}


@app.delete("/api/alarms/{alarm_id}")
def delete_alarm(alarm_id: str) -> dict:
    ok = service.cancel_alarm(alarm_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return {"ok": True}


@app.post("/api/settings/model")
def update_model(payload: ModelSettingsRequest) -> dict:
    return service.switch_model(payload.provider, payload.model, payload.api_key)


@app.get("/api/tools")
def tools() -> dict:
    return {"items": list_tools()}


@app.post("/api/tools/run")
def tools_run(payload: ToolRunRequest) -> dict:
    result = run_tool(service, payload.name, payload.args)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Tool call failed"))
    return result
