import logging
from fastapi import APIRouter
import edge_tts

logger = logging.getLogger(__name__)
router = APIRouter()


def _extract_chinese_name(short_name: str) -> str:
    name_map = {
        "Xiaoxiao": "晓晓",
        "Xiaoyi": "晓伊",
        "Xiaochen": "晓辰",
        "Xiaohan": "晓涵",
        "Xiaomeng": "晓梦",
        "Xiaomo": "晓墨",
        "Xiaoqiu": "晓秋",
        "Xiaorui": "晓睿",
        "Xiaoshuang": "晓双",
        "Xiaoxuan": "晓萱",
        "Xiaoyan": "晓颜",
        "Xiaoyou": "晓悠",
        "Xiaozhen": "晓甄",
        "Xiaobei": "晓北",
        "Xiaoni": "晓妮",
        "Yunxi": "云希",
        "Yunyang": "云扬",
        "Yunjian": "云健",
        "Yunfeng": "云枫",
        "Yunhao": "云皓",
        "Yunxia": "云夏",
        "Yunye": "云野",
        "Yunze": "云泽",
        "HsiaoChen": "晓臻",
        "YunJhe": "云哲",
        "HsiaoYu": "晓雨",
        "HiuGaai": "晓佳",
        "HiuMaan": "晓文",
        "WanLung": "云龙",
    }
    name = short_name.split("-")[-1].replace("Neural", "")
    for eng, chn in name_map.items():
        if eng == name:
            return chn
    return name


def _extract_personality(voice: dict) -> str:
    short_name = voice.get("ShortName", "")
    name = short_name.split("-")[-1].replace("Neural", "")

    # 个别音色手动覆盖
    overrides = {
        "Yunxi": ["青年"],
        "Yunxia": ["可爱"],
    }
    for key, val in overrides.items():
        if key == name:
            return " · ".join(val)

    personality_map = {
        "Warm": "温柔",
        "Lively": "甜美",
        "Passion": "热情",
        "Sunshine": "阳光",
        "Cute": "可爱",
        "Professional": "专业",
        "Reliable": "可靠",
        "Humorous": "幽默",
        "Bright": "明亮",
        "Friendly": "亲切",
        "Radiant": "灿烂",
        "Serious": "严肃",
        "Calm": "冷静",
        "Excited": "兴奋",
        "Angry": "愤怒",
        "Sad": "悲伤",
        "Cheerful": "欢快",
        "Gentle": "柔和",
        "Lyrical": "诗意",
    }
    tag = voice.get("VoiceTag", {}) or {}
    raw_personalities = tag.get("VoicePersonalities", []) or []
    mapped = [personality_map.get(p, p) for p in raw_personalities if p]
    return " · ".join(mapped) if mapped else ""


@router.get("/voices")
async def list_voices():
    voices = await edge_tts.list_voices()
    result = []
    for v in voices:
        locale = v["Locale"]
        if not locale.startswith("zh"):
            continue
        short_name = v["ShortName"]
        result.append({
            "name": short_name,
            "display_name": v["FriendlyName"],
            "locale": locale,
            "gender": v["Gender"],
            "language": locale.split("-")[0],
            "chinese_name": _extract_chinese_name(short_name),
            "personality": _extract_personality(v),
        })
    return {"voices": result}