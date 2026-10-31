# خدمة داخلية لإزالة خلفية صور المنتجات (rembg). تستمع على 127.0.0.1 فقط ويناديها الـAPI
import asyncio
import io
import os
import time

from fastapi import FastAPI, File, HTTPException, Query, Response, UploadFile
from PIL import Image, ImageOps
from rembg import new_session, remove

MAX_BYTES = int(os.getenv("BG_MAX_BYTES", str(12 * 1024 * 1024)))
CONCURRENCY = int(os.getenv("BG_CONCURRENCY", "3"))
MODELS = os.getenv("BG_MODELS", "isnet-general-use").split(",")
HARD_MAX_SIDE = int(os.getenv("BG_HARD_MAX_SIDE", "2048"))

sessions = {m: new_session(m) for m in MODELS}
gate = asyncio.Semaphore(CONCURRENCY)
waiting = 0
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def run(data: bytes, model: str, max_side: int) -> bytes:
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    # max_side=0 (الافتراضي) = الصورة بحجمها كما وصلت، إلا ما تجاوز الحد الأعلى للحماية من نفاد الذاكرة
    limit = min(max_side, HARD_MAX_SIDE) if max_side else HARD_MAX_SIDE
    if limit and max(img.size) > limit:
        img.thumbnail((limit, limit), Image.LANCZOS)
    out = remove(img, session=sessions[model])
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()


@app.get("/health")
def health():
    return {"ok": True, "models": MODELS, "concurrency": CONCURRENCY, "waiting": waiting}


@app.post("/remove")
async def remove_bg(file: UploadFile = File(...), model: str = Query(MODELS[0]), max_side: int = Query(0, ge=0, le=4096)):
    global waiting
    if model not in sessions:
        raise HTTPException(400, "unknown model")
    data = await file.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "file too large or empty")
    waiting += 1
    queued = time.perf_counter()
    try:
        async with gate:
            started = time.perf_counter()
            try:
                png = await asyncio.to_thread(run, data, model, max_side)
            except Exception:
                raise HTTPException(422, "cannot process image")
    finally:
        waiting -= 1
    done = time.perf_counter()
    return Response(png, media_type="image/png", headers={
        "X-Queue-Ms": str(int((started - queued) * 1000)),
        "X-Process-Ms": str(int((done - started) * 1000)),
    })
