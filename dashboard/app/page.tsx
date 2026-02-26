"use client";
import { useEffect, useState, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell
} from "recharts";

const VM_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Stats { total_traces: number; guardrail_blocks: number; avg_latency_ms: number; total_tokens: number; total_danger_zone: number; }
interface Claim { text: string; confidence: number; accuracy: number; supported: boolean; issue: string | null; }
interface Trace { trace_id: string; agent_name: string; prompt: string; guardrail_status: string; claims: Claim[]; danger_zone_count: number; }
interface Pt { x: number; y: number; text: string; agent: string; danger: boolean; }

const SUGGESTIONS = ["Should I buy Tesla?", "Analyze NVIDIA", "Research Apple", "Is Microsoft overvalued?", "Research Amazon"];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Pt;
  return (
    <div style={{ background: 'var(--surface-2)', border: `1px solid ${d.danger ? 'rgba(255,68,68,0.4)' : 'rgba(0,212,160,0.3)'}`, borderRadius: '10px', padding: '12px 14px', maxWidth: '260px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: d.danger ? 'var(--red)' : 'var(--teal)', flexShrink: 0 }} />
        <span className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: d.danger ? 'var(--red)' : 'var(--teal)' }}>
          {d.danger ? 'Danger Zone' : 'Safe'} · {d.agent.replace('_agent', '')}
        </span>
      </div>
      <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text)', marginBottom: '10px' }}>{d.text}</p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-2)' }}>conf <strong style={{ color: 'var(--text)' }}>{(d.y * 100).toFixed(0)}%</strong></span>
        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-2)' }}>acc <strong style={{ color: 'var(--text)' }}>{(d.x * 100).toFixed(0)}%</strong></span>
      </div>
    </div>
  );
};

export default function MissionControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scatter, setScatter] = useState<Pt[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [sRes, tRes] = await Promise.all([fetch(`${VM_URL}/stats`), fetch(`${VM_URL}/traces`)]);
    const s: Stats = await sRes.json();
    const traces: Trace[] = await tRes.json();
    setStats(s);
    setLastUpdate(new Date());
    const pts: Pt[] = [];
    for (const t of traces)
      for (const c of (t.claims ?? []))
        pts.push({ x: c.accuracy, y: c.confidence, text: c.text, agent: t.agent_name, danger: c.confidence > 0.7 && c.accuracy < 0.4 });
    setScatter(pts);
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, []);

  const handleRun = async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch(`${VM_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        setRunError(err.detail ?? "Something went wrong");
      } else {
        const data = await res.json();
        setRunResult(data);
        await fetchData(); // refresh immediately
      }
    } catch (e) {
      setRunError("Failed to reach server");
    } finally {
      setRunning(false);
    }
  };

  const blockRate = stats && stats.total_traces > 0 ? ((stats.guardrail_blocks / stats.total_traces) * 100).toFixed(0) : "0";
  const dangerPts = scatter.filter(p => p.danger);
  const safePts = scatter.filter(p => !p.danger);

  return (
    <main style={{ maxWidth: '1160px', margin: '0 auto', padding: '48px 32px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: '44px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '10px' }}>◆ Live Pipeline</p>
            <h1 className="display" style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.1, marginBottom: '8px' }}>Mission Control</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Hallucination detection across {stats?.total_traces ?? '—'} agent calls</p>
          </div>
          {lastUpdate && <p className="mono" style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>updated {lastUpdate.toLocaleTimeString()}</p>}
        </div>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, var(--border-2), transparent)', marginTop: '28px' }} />
      </div>

      {/* Query input */}
      <div className="card fade-up-1" style={{ padding: '28px 32px', marginBottom: '24px' }}>
        <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>Run Pipeline</p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            placeholder="e.g. Should I buy Tesla? or Analyze NVIDIA..."
            disabled={running}
            style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: '8px',
              padding: '12px 16px', color: 'var(--text)', fontFamily: 'Inter, sans-serif', fontSize: '14px',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--amber)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
          />
          <button
            onClick={handleRun}
            disabled={running || !query.trim()}
            style={{
              padding: '12px 28px', borderRadius: '8px', border: 'none', cursor: running || !query.trim() ? 'not-allowed' : 'pointer',
              background: running ? 'var(--surface-2)' : 'var(--amber)', color: running ? 'var(--text-3)' : '#000',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em',
              transition: 'all 0.2s', whiteSpace: 'nowrap', minWidth: '100px',
            }}
          >
            {running ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--text-3)', borderTopColor: 'var(--text-2)', animation: 'spin 0.8s linear infinite' }} />
                Running
              </span>
            ) : 'Run →'}
          </button>
        </div>

        {/* Suggestions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setQuery(s); inputRef.current?.focus(); }}
              style={{ padding: '4px 12px', borderRadius: '100px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '11px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-2)'; (e.target as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-2)'; }}
            >{s}</button>
          ))}
        </div>

        {/* Result banner */}
        {runResult && (
          <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '8px', background: runResult.status === 'BLOCK' ? 'rgba(255,68,68,0.06)' : 'rgba(0,212,160,0.06)', border: `1px solid ${runResult.status === 'BLOCK' ? 'rgba(255,68,68,0.2)' : 'rgba(0,212,160,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={`badge ${runResult.status === 'BLOCK' ? 'badge-block' : 'badge-pass'}`}>{runResult.status}</span>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                {runResult.status === 'BLOCK' ? `Blocked — ${runResult.total_danger_zone} hallucination${runResult.total_danger_zone !== 1 ? 's' : ''} detected` : 'Pipeline passed — no high-confidence hallucinations detected'}
              </span>
            </div>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--text-3)' }}>session {runResult.session_id.slice(0, 8)}</span>
          </div>
        )}

        {runError && (
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <span style={{ fontSize: '13px', color: 'var(--red)' }}>⚠ {runError}</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: "Total Traces", value: stats?.total_traces ?? '—', sub: "agent calls logged", type: 'default', delay: 1 },
          { label: "Guardrail Blocks", value: stats?.guardrail_blocks ?? '—', sub: `${blockRate}% of all calls blocked`, type: 'danger', delay: 2 },
          { label: "Danger Zone", value: stats?.total_danger_zone ?? '—', sub: "high-confidence hallucinations", type: 'amber', delay: 3 },
          { label: "Avg Latency", value: stats ? `${stats.avg_latency_ms}ms` : '—', sub: "per agent call end-to-end", type: 'default', delay: 4 },
        ].map(({ label, value, sub, type, delay }) => (
          <div key={label} className={`card fade-up-${delay} ${type === 'danger' ? 'card-danger' : type === 'amber' ? 'card-amber' : ''}`}
            style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</p>
            <p className={type === 'danger' ? 'stat-number-red' : type === 'amber' ? 'stat-number-amber' : 'stat-number'} style={{ fontSize: '2.8rem', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Scatter */}
      <div className="card fade-up-4" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Hallucination Map</p>
            <h2 className="display" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Confidence vs. Accuracy</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', maxWidth: '480px' }}>Each dot is a factual claim extracted from an AI response. Top-left = confident about something it got wrong.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', paddingTop: '4px' }}>
            {[['var(--red)', 'Danger zone'], ['var(--teal)', 'Accurate']].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                <span className="mono" style={{ fontSize: '10px', color: 'var(--text-2)', letterSpacing: '0.04em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }} />

        {scatter.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '18px' }}>◎</span>
            </div>
            <p className="mono" style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>Run a query to see claims appear here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,42,69,0.8)" />
              <XAxis type="number" dataKey="x" domain={[0,1]} name="Accuracy"
                label={{ value: 'Accuracy →', position: 'insideBottom', offset: -14, fill: 'var(--text-3)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} stroke="var(--border)" />
              <YAxis type="number" dataKey="y" domain={[0,1]} name="Confidence"
                label={{ value: 'Confidence', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-3)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} stroke="var(--border)" />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <ReferenceLine x={0.4} stroke="rgba(255,68,68,0.15)" strokeDasharray="4 4" strokeWidth={1.5} />
              <ReferenceLine y={0.7} stroke="rgba(255,68,68,0.15)" strokeDasharray="4 4" strokeWidth={1.5} />
              <Scatter data={safePts} fillOpacity={0.75} r={5}>{safePts.map((_,i) => <Cell key={i} fill="var(--teal)" />)}</Scatter>
              <Scatter data={dangerPts} fillOpacity={0.9} r={6}>{dangerPts.map((_,i) => <Cell key={i} fill="var(--red)" />)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {dangerPts.length > 0 && (
          <div style={{ marginTop: '24px', padding: '16px 20px', background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.15)', borderRadius: '8px' }}>
            <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '12px' }}>⚠ {dangerPts.length} Danger Zone Claim{dangerPts.length > 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dangerPts.map((p,i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: '9px', color: 'var(--text-3)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.agent.replace('_agent', '')}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}