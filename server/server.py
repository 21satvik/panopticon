from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

conn = psycopg2.connect(
    dbname="panopticon",
    user="postgres",
    password=os.getenv("PGPASSWORD"),
    host="localhost"
)

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

@app.post("/ingest")
def ingest(trace: Trace):
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
            guardrail_score, guardrail_reasoning
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        trace.trace_id, trace.session_id, trace.agent_name,
        trace.prompt, trace.response, trace.tokens_used,
        trace.latency_ms, trace.guardrail_status,
        trace.guardrail_score, trace.guardrail_reasoning
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
    cur.close()
    return {
        "total_traces": total,
        "guardrail_blocks": blocks,
        "avg_latency_ms": avg_latency,
        "total_tokens": total_tokens
    }

@app.get("/traces")
def get_traces():
    cur = conn.cursor()
    cur.execute("""
        SELECT trace_id, session_id, agent_name, prompt, response,
               tokens_used, latency_ms, guardrail_status, 
               guardrail_score, guardrail_reasoning, created_at
        FROM traces ORDER BY created_at DESC LIMIT 100
    """)
    rows = cur.fetchall()
    cur.close()
    keys = ["trace_id","session_id","agent_name","prompt","response",
            "tokens_used","latency_ms","guardrail_status",
            "guardrail_score","guardrail_reasoning","created_at"]
    return [dict(zip(keys, row)) for row in rows]