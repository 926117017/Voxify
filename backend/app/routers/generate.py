import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

tasks: dict[str, dict] = {}


class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to convert to speech")
    voice: str = Field(default="zh-CN-XiaoxiaoNeural")
    rate: str = Field(default="+0%")
    volume: str = Field(default="+0%")
    pitch: str = Field(default="+0Hz")
    hajimi: bool = Field(default=False, description="Apply Hajimi voice effect")


@router.post("/generate")
async def generate_task(req: GenerateRequest):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "total": 0,
        "download_url": None,
        "_ts": time.time(),
    }
    asyncio.create_task(_run_generation(task_id, req))
    return {"task_id": task_id, "status": "pending"}


@router.get("/task/{task_id}")
async def get_task(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "status": task["status"],
        "progress": task["progress"],
        "total": task["total"],
        "download_url": task.get("download_url"),
        "error": task.get("error"),
    }


def _split_text(text: str) -> list[str]:
    import re
    text = text.replace("...", "。").replace("…", "。")
    paragraphs = text.strip().split("\n")
    segments = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        sentences = re.split(r"(?<=[。！？.!?])", para)
        for s in sentences:
            s = s.strip()
            if len(s) >= 2:
                segments.append(s)

    if not segments:
        cleaned = text.strip()
        return [cleaned] if cleaned else []

    merged = []
    buf = ""
    for s in segments:
        if len(buf) + len(s) > 200:
            if buf:
                merged.append(buf)
            buf = s
        else:
            buf += s
    if buf:
        merged.append(buf)

    return merged


async def _generate_sentence(
    sentence: str,
    voice: str,
    rate: str,
    volume: str,
    pitch: str,
) -> bytearray:
    import edge_tts

    communicate = edge_tts.Communicate(
        text=sentence,
        voice=voice,
        rate=rate,
        volume=volume,
        pitch=pitch,
        connect_timeout=30,
        receive_timeout=120,
    )
    audio = bytearray()
    async for message in communicate.stream():
        if message["type"] == "audio":
            audio.extend(message["data"])
    return audio


async def _run_generation(task_id: str, req: GenerateRequest):
    import edge_tts

    task = tasks[task_id]
    task["status"] = "running"

    segments = _split_text(req.text)
    task["total"] = len(segments)
    task["progress"] = 0

    output_dir = OUTPUT_DIR / task_id
    output_dir.mkdir(exist_ok=True)
    output_file = OUTPUT_DIR / f"{task_id}.mp3"

    # Clear proxy env vars so edge-tts connects directly
    old_http = os.environ.pop("HTTP_PROXY", None)
    old_https = os.environ.pop("HTTPS_PROXY", None)
    old_http_lower = os.environ.pop("http_proxy", None)
    old_https_lower = os.environ.pop("https_proxy", None)

    try:
        # Write all audio segments to a single temp file sequentially
        temp_files = []

        for i, segment in enumerate(segments):
            segment_file = output_dir / f"seg_{i:05d}.mp3"
            temp_files.append(str(segment_file))

            last_error = None
            for attempt in range(10):
                try:
                    audio = await _generate_sentence(
                        segment,
                        req.voice,
                        req.rate,
                        req.volume,
                        req.pitch,
                    )
                    if len(audio) > 0:
                        with open(segment_file, "wb") as f:
                            f.write(bytes(audio))
                        break
                except Exception as e:
                    last_error = e
                    wait = min(2 ** attempt, 30)
                    logger.warning(
                        "Sentence %d attempt %d/10 failed: %s, retry in %ds",
                        i, attempt + 1, e, wait,
                    )
                    await asyncio.sleep(wait)
            else:
                raise RuntimeError(
                    f"Sentence {i} failed after 10 attempts: {last_error}"
                )

            task["progress"] = i + 1
            logger.info("Progress: %d/%d", i + 1, len(segments))

        # Merge
        valid_files = [
            f for f in temp_files
            if os.path.exists(f) and os.path.getsize(f) > 0
        ]
        if not valid_files:
            raise RuntimeError("所有音频片段都为空，无法生成")

        await _merge_audio(valid_files, str(output_file))

        if req.hajimi:
            hajimi_file = output_dir / f"hajimi_{task_id}.mp3"
            await _apply_hajimi(str(output_file), str(hajimi_file))
            os.replace(str(hajimi_file), str(output_file))

        task["status"] = "completed"
        task["download_url"] = f"/download/{task_id}.mp3"
        task["_ts"] = time.time()

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}", exc_info=True)
        task["status"] = "failed"
        task["error"] = str(e)
        task["_ts"] = time.time()

    finally:
        # Restore proxy env vars
        if old_http is not None:
            os.environ["HTTP_PROXY"] = old_http
        if old_https is not None:
            os.environ["HTTPS_PROXY"] = old_https
        if old_http_lower is not None:
            os.environ["http_proxy"] = old_http_lower
        if old_https_lower is not None:
            os.environ["https_proxy"] = old_https_lower

        # Cleanup temp files
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass
        try:
            os.rmdir(str(output_dir))
        except Exception:
            pass
        remove_outdated_tasks(task_id)


def remove_outdated_tasks(task_id: str) -> None:
    for tid in list(tasks.keys()):
        if tid == task_id:
            continue
        t = tasks[tid].get("_ts", 0)
        if t and time.time() - t > 3600:
            del tasks[tid]


def _find_ffmpeg() -> str:
    candidates = [
        "ffmpeg",
        r"C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe",
    ]
    for c in candidates:
        resolved = shutil.which(c)
        if resolved:
            return resolved
    raise FileNotFoundError("FFmpeg not found")


async def _apply_hajimi(input_path: str, output_path: str):
    """Apply Hajimi voice effect: pitch shift up ~7 semitones."""
    ffmpeg_path = _find_ffmpeg()
    proc = await asyncio.create_subprocess_exec(
        ffmpeg_path,
        "-i", input_path,
        "-af", "rubberband=pitch=1.5",
        "-y", output_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=60
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError("FFmpeg Hajimi processing timed out")

    if proc.returncode != 0:
        msg = stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"FFmpeg Hajimi error: {msg}")


async def _merge_audio(file_list: list[str], output_path: str):
    ffmpeg_path = _find_ffmpeg()
    list_file = os.path.join(os.path.dirname(output_path), "file_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for fp in file_list:
            f.write(f"file '{os.path.abspath(fp)}'\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            ffmpeg_path,
            "-f", "concat",
            "-safe", "0",
            "-i", list_file,
            "-c", "copy",
            "-y", output_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=120
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise RuntimeError("FFmpeg timed out")

        if proc.returncode != 0:
            msg = stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"FFmpeg error: {msg}")
    finally:
        if os.path.exists(list_file):
            os.remove(list_file)
