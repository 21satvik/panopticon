import os
import json
import psycopg2
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

# Auto-migrate: add new columns if they don't exist
def migrate():
    cur = conn.cursor()
    migrations = [
        "ALTER TABLE traces ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]'",
        "ALTER TABLE traces ADD COLUMN IF NOT EXISTS danger_zone_count INTEGER DEFAULT 0",
    ]
    for sql in migrations:
        try:
            cur.execute(sql)
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Migration skipped: {e}")
    cur.close()

migrate()


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


@app.post("/ingest")
def ingest(trace: Trace, _: str = Depends(verify_api_key)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sessions (session_id)
        VALUES (%s)
        ON CONFLICT (session_id) DO NOTHING
    """, (trace.session_id,))

    cur.execute("""
        INSERT INTO traces (
            trace_id, session_id, agent_name, prompt, response,
            tokens_used, latency_ms, guardrail_status,
            guardrail_score, guardrail_reasoning, claims, danger_zone_count
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        trace.trace_id, trace.session_id, trace.agent_name,
        trace.prompt, trace.response, trace.tokens_used,
        trace.latency_ms, trace.guardrail_status,
        trace.guardrail_score, trace.guardrail_reasoning,
        json.dumps(trace.claims), trace.danger_zone_count
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
    return {
        "total_traces": total,
        "guardrail_blocks": blocks,
        "avg_latency_ms": avg_latency,
        "total_tokens": total_tokens,
        "total_danger_zone": total_danger,
    }


@app.get("/traces")
def get_traces():
    cur = conn.cursor()
    cur.execute("""
        SELECT trace_id, session_id, agent_name, prompt, response,
               tokens_used, latency_ms, guardrail_status,
               guardrail_score, guardrail_reasoning, claims, danger_zone_count, created_at
        FROM traces ORDER BY created_at DESC LIMIT 100
    """)
    rows = cur.fetchall()
    cur.close()
    keys = ["trace_id", "session_id", "agent_name", "prompt", "response",
            "tokens_used", "latency_ms", "guardrail_status",
            "guardrail_score", "guardrail_reasoning", "claims", "danger_zone_count", "created_at"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        # claims comes back from postgres as a dict/list already if JSONB, but ensure it's parsed
        if isinstance(d["claims"], str):
            try:
                d["claims"] = json.loads(d["claims"])
            except Exception:
                d["claims"] = []
        result.append(d)
    return result