import sys
from pathlib import Path
import uvicorn

if getattr(sys, 'frozen', False):
    ROOT = Path(sys._MEIPASS)
else:
    ROOT = Path(__file__).resolve().parent

SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

if __name__ == "__main__":
    uvicorn.run("ai_trader.api:app", host="127.0.0.1", port=8000, reload=False)     