import time
import uuid
import json
import httpx
import asyncio
from functools import wraps
from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
INGESTION_URL = os.getenv("INGESTION_URL")
INGEST_API_KEY = os.getenv("INGEST_API_KEY", "")

JUDGE_SYSTEM_PROMPT = """You are a financial AI hallucination auditor.

You are given:
1. SOURCE DATA — real market data pulled from yfinance (ground truth)
2. AI RESPONSE — what the language model said

Your job: extract every factual claim the AI made and audit each one.

For each claim score:
- confidence: how assertively did the model state this? (0.0 = heavily hedged, 1.0 = stated as absolute fact)
- accuracy: is this actually supported by the source data? (0.0 = contradicts source, 1.0 = fully supported)

DANGER ZONE = confidence > 0.7 AND accuracy < 0.4
This means: the model stated something confidently that the data does not support. That is a hallucination.

Return ONLY valid JSON, no explanation outside it:
{
  "overall_status": "PASS" or "BLOCK",
  "overall_score": 0.0,
  "overall_reasoning": "one sentence summary",
  "claims": [
    {
      "text": "exact claim the model made",
      "confidence": 0.0,
      "accuracy": 0.0,
      "supported": true,
      "issue": null
    }
  ],
  "danger_zone_count": 0
}

BLOCK if danger_zone_count >= 1.
Focus on numerical claims, valuations, characterizations of financial health, and trend assertions.
Ignore generic disclaimers."""


def judge_output(agent_name: str, prompt: str, response: str, source_data: str = "") -> dict:
    user_content = f"PROMPT: {prompt}\n\nSOURCE DATA (ground truth):\n{source_data}\n\nAI RESPONSE:\n{response}"

    result = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ],
        response_format={"type": "json_object"}
    )
    try:
        return json.loads(result.choices[0].message.content)
    except json.JSONDecodeError:
        return {
            "overall_status": "PASS",
            "overall_score": 0.0,
            "overall_reasoning": "Judge returned malformed JSON — defaulting to PASS.",
            "claims": [],
            "danger_zone_count": 0
        }


async def ship_telemetry(payload: dict):
    headers = {"X-API-Key": INGEST_API_KEY} if INGEST_API_KEY else {}
    async with httpx.AsyncClient() as client:
        try:
            await client.post(INGESTION_URL, json=payload, headers=headers, timeout=5.0)
        except Exception:
            pass  # never let telemetry crash your app


def observe(agent_name: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            trace_id = str(uuid.uuid4())
            session_id = kwargs.get("session_id", str(uuid.uuid4()))
            prompt = kwargs.get("prompt", str(args[0]) if args else "")

            start = time.time()
            response = await func(*args, **kwargs)
            latency_ms = round((time.time() - start) * 1000)

            tokens_used = getattr(response, "_tokens_used", 0)
            response_text = getattr(response, "text", str(response))
            source_data = getattr(response, "_source_data", "")

            judgment = judge_output(agent_name, prompt, response_text, source_data)

            payload = {
                "trace_id": trace_id,
                "session_id": session_id,
                "agent_name": agent_name,
                "prompt": prompt,
                "response": response_text,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms,
                "guardrail_status": judgment.get("overall_status", "PASS"),
                "guardrail_score": judgment.get("overall_score", 0.0),
                "guardrail_reasoning": judgment.get("overall_reasoning", ""),
                "claims": judgment.get("claims", []),
                "danger_zone_count": judgment.get("danger_zone_count", 0),
            }

            await ship_telemetry(payload)
            return response

        return wrapper
    return decorator