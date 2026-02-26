import os
import json
import time
import uuid
import asyncio
import psycopg2
import yfinance as yf
from groq import Groq
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
API_KEY = os.getenv("INGEST_API_KEY", "")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(key: str = Security(api_key_header)):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return key

conn = psycopg2.connect(
    dbname="panopticon",
    user="postgres",
    password=os.getenv("PGPASSWORD"),
    host="localhost"
)

def migrate():
    cur = conn.cursor()
    for sql in [
        "ALTER TABLE traces ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]'",
        "ALTER TABLE traces ADD COLUMN IF NOT EXISTS danger_zone_count INTEGER DEFAULT 0",
    ]:
        try:
            cur.execute(sql)
            conn.commit()
        except Exception:
            conn.rollback()
    cur.close()

migrate()

# ── Models ────────────────────────────────────────────────────────────────────

class Trace(BaseModel):
    trace_id: str
    session_id: str
    agent_name: str
    prompt: str
    response: str
    tokens_used: int
    latency_ms: int
    guardrail_status: str
    guardrail_score: float
    guardrail_reasoning: str
    claims: List[Any] = []
    danger_zone_count: int = 0

class RunRequest(BaseModel):
    query: str

# ── Pipeline logic ────────────────────────────────────────────────────────────

TICKER_MAP = {
    "apple": "AAPL", "nvidia": "NVDA", "microsoft": "MSFT",
    "tesla": "TSLA", "google": "GOOGL", "googl": "GOOGL",
    "amazon": "AMZN", "meta": "META", "netflix": "NFLX",
    "amd": "AMD", "intel": "INTC", "salesforce": "CRM",
    "uber": "UBER", "airbnb": "ABNB", "spotify": "SPOT",
}

JUDGE_PROMPT = """You are a financial AI hallucination auditor.

You are given:
1. SOURCE DATA — real market data pulled from yfinance (ground truth)
2. AI RESPONSE — what the language model said

Your job: extract every factual claim the AI made and audit each one.

For each claim score:
- confidence: how assertively did the model state this? (0.0 = heavily hedged, 1.0 = stated as absolute fact)
- accuracy: is this actually supported by the source data? (0.0 = contradicts source, 1.0 = fully supported)

DANGER ZONE = confidence > 0.7 AND accuracy < 0.4

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
Ignore generic disclaimers.
CRITICAL: Output pure JSON only. No comments, no # annotations, no text outside the JSON object."""


def get_source_data(query: str) -> tuple[str, str | None]:
    ticker = None
    for name, symbol in TICKER_MAP.items():
        if name in query.lower():
            ticker = symbol
            break
    if not ticker:
        return "", None

    info = yf.Ticker(ticker).info
    source = f"""
Company: {info.get('longName', ticker)}
Sector: {info.get('sector', 'N/A')}
Current Price: ${info.get('currentPrice', 'N/A')}
Market Cap: ${info.get('marketCap', 'N/A')}
P/E Ratio: {info.get('trailingPE', 'N/A')}
Forward P/E: {info.get('forwardPE', 'N/A')}
Revenue: ${info.get('totalRevenue', 'N/A')}
Gross Margins: {info.get('grossMargins', 'N/A')}
Profit Margins: {info.get('profitMargins', 'N/A')}
52 Week High: ${info.get('fiftyTwoWeekHigh', 'N/A')}
52 Week Low: ${info.get('fiftyTwoWeekLow', 'N/A')}
50 Day Average: ${info.get('fiftyDayAverage', 'N/A')}
200 Day Average: ${info.get('twoHundredDayAverage', 'N/A')}
Debt to Equity: {info.get('debtToEquity', 'N/A')}
Return on Equity: {info.get('returnOnEquity', 'N/A')}
Free Cashflow: ${info.get('freeCashflow', 'N/A')}
Analyst Recommendation: {info.get('recommendationKey', 'N/A')}
Beta: {info.get('beta', 'N/A')}
""".strip()
    return source, ticker


def run_agent(agent_name: str, system_prompt: str, user_prompt: str) -> tuple[str, int]:
    result = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
    return result.choices[0].message.content, result.usage.total_tokens


def judge(agent_name: str, prompt: str, response: str, source_data: str) -> dict:
    result = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": JUDGE_PROMPT},
            {"role": "user", "content": f"PROMPT: {prompt}\n\nSOURCE DATA:\n{source_data}\n\nAI RESPONSE:\n{response}"}
        ],
        response_format={"type": "json_object"}
    )
    try:
        return json.loads(result.choices[0].message.content)
    except Exception:
        return {"overall_status": "PASS", "overall_score": 0.0, "overall_reasoning": "Judge parse error.", "claims": [], "danger_zone_count": 0}


def save_trace(trace_id, session_id, agent_name, prompt, response, tokens, latency, judgment):
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (session_id) VALUES (%s) ON CONFLICT DO NOTHING", (session_id,))
    cur.execute("""
        INSERT INTO traces (trace_id, session_id, agent_name, prompt, response,
            tokens_used, latency_ms, guardrail_status, guardrail_score,
            guardrail_reasoning, claims, danger_zone_count)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        trace_id, session_id, agent_name, prompt, response, tokens, latency,
        judgment.get("overall_status", "PASS"),
        judgment.get("overall_score", 0.0),
        judgment.get("overall_reasoning", ""),
        json.dumps(judgment.get("claims", [])),
        judgment.get("danger_zone_count", 0),
    ))
    conn.commit()
    cur.close()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/run")
def run_pipeline(req: RunRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    session_id = str(uuid.uuid4())
    source_data, ticker = get_source_data(query)

    if not ticker:
        raise HTTPException(status_code=400, detail="Couldn't identify a company. Try mentioning Apple, NVIDIA, Tesla, Microsoft, Google, Amazon, Meta, Netflix, AMD, Intel, Salesforce, Uber, Airbnb, or Spotify.")

    results = []

    # Agent 1: Retrieval
    t0 = time.time()
    retrieval_text, retrieval_tokens = run_agent(
        "retrieval_agent",
        "You are a financial data retrieval agent. Summarize the provided company data clearly and concisely for analysis.",
        f"Query: {query}\n\nRaw Data:\n{source_data}"
    )
    retrieval_latency = round((time.time() - t0) * 1000)
    retrieval_judgment = judge("retrieval_agent", query, retrieval_text, source_data)
    retrieval_id = str(uuid.uuid4())
    save_trace(retrieval_id, session_id, "retrieval_agent", query, retrieval_text, retrieval_tokens, retrieval_latency, retrieval_judgment)
    results.append({"agent": "retrieval_agent", "status": retrieval_judgment.get("overall_status"), "danger_zone_count": retrieval_judgment.get("danger_zone_count", 0)})

    # Agent 2: Analysis
    t0 = time.time()
    analysis_text, analysis_tokens = run_agent(
        "analysis_agent",
        """You are a financial analysis agent.
Generate a structured investment brief with these sections:
- Executive Summary
- Key Strengths
- Key Risks
- Financial Health
- Conclusion

Always include a disclaimer that this is not financial advice.""",
        f"Query: {query}\n\nContext:\n{retrieval_text}"
    )
    analysis_latency = round((time.time() - t0) * 1000)
    analysis_judgment = judge("analysis_agent", query, analysis_text, source_data)
    analysis_id = str(uuid.uuid4())
    save_trace(analysis_id, session_id, "analysis_agent", query, analysis_text, analysis_tokens, analysis_latency, analysis_judgment)
    results.append({"agent": "analysis_agent", "status": analysis_judgment.get("overall_status"), "danger_zone_count": analysis_judgment.get("danger_zone_count", 0)})

    total_danger = sum(r["danger_zone_count"] for r in results)
    final_status = "BLOCK" if any(r["status"] == "BLOCK" for r in results) else "PASS"

    return {
        "session_id": session_id,
        "status": final_status,
        "total_danger_zone": total_danger,
        "agents": results
    }


@app.post("/ingest")
def ingest(trace: Trace, _: str = Depends(verify_api_key)):
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (session_id) VALUES (%s) ON CONFLICT (session_id) DO NOTHING", (trace.session_id,))
    cur.execute("""
        INSERT INTO traces (trace_id, session_id, agent_name, prompt, response,
            tokens_used, latency_ms, guardrail_status, guardrail_score,
            guardrail_reasoning, claims, danger_zone_count)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        trace.trace_id, trace.session_id, trace.agent_name, trace.prompt, trace.response,
        trace.tokens_used, trace.latency_ms, trace.guardrail_status, trace.guardrail_score,
        trace.guardrail_reasoning, json.dumps(trace.claims), trace.danger_zone_count
    ))
    conn.commit()
    cur.close()
    return {"status": "ok"}


@app.get("/stats")
def stats():
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM traces")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM traces WHERE guardrail_status = 'BLOCK'")
    blocks = cur.fetchone()[0]
    cur.execute("SELECT AVG(latency_ms) FROM traces")
    avg_latency = round(cur.fetchone()[0] or 0)
    cur.execute("SELECT SUM(tokens_used) FROM traces")
    total_tokens = cur.fetchone()[0] or 0
    cur.execute("SELECT SUM(danger_zone_count) FROM traces")
    total_danger = cur.fetchone()[0] or 0
    cur.close()
    return {"total_traces": total, "guardrail_blocks": blocks, "avg_latency_ms": avg_latency, "total_tokens": total_tokens, "total_danger_zone": total_danger}


@app.get("/traces")
def get_traces():
    cur = conn.cursor()
    cur.execute("""
        SELECT trace_id, session_id, agent_name, prompt, response,
               tokens_used, latency_ms, guardrail_status, guardrail_score,
               guardrail_reasoning, claims, danger_zone_count, created_at
        FROM traces ORDER BY created_at DESC LIMIT 100
    """)
    rows = cur.fetchall()
    cur.close()
    keys = ["trace_id","session_id","agent_name","prompt","response","tokens_used","latency_ms",
            "guardrail_status","guardrail_score","guardrail_reasoning","claims","danger_zone_count","created_at"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if isinstance(d["claims"], str):
            try: d["claims"] = json.loads(d["claims"])
            except: d["claims"] = []
        result.append(d)
    return result