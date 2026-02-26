"use client";
import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from "recharts";

const VM_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Stats {
  total_traces: number;
  guardrail_blocks: number;
  avg_latency_ms: number;
  total_tokens: number;
  total_danger_zone: number;
}

interface Claim {
  text: string;
  confidence: number;
  accuracy: number;
  supported: boolean;
  issue: string | null;
}

interface Trace {
  trace_id: string;
  agent_name: string;
  prompt: string;
  guardrail_status: string;
  claims: Claim[];
  danger_zone_count: number;
  created_at: string;
}

interface ScatterPoint {
  x: number;
  y: number;
  text: string;
  agent: string;
  danger: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ScatterPoint;
  return (
    <div style={{ background: '#111', border: `1px solid ${d.danger ? 'rgba(255,59,59,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '12px 14px', maxWidth: 280 }}>
      <p className="mono text-xs mb-2" style={{ color: d.danger ? '#ff3b3b' : '#00ff88' }}>
        {d.danger ? '⚠ DANGER ZONE' : '✓ SAFE'}
      </p>
      <p className="text-xs leading-relaxed mb-2" style={{ color: '#f0f0f0' }}>{d.text}</p>
      <p className="mono text-xs" style={{ color: '#666' }}>confidence {d.y.toFixed(2)} · accuracy {d.x.toFixed(2)}</p>
    </div>
  );
};

export default function MissionControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([]);

  const fetchData = async () => {
    const [statsRes, tracesRes] = await Promise.all([
      fetch(`${VM_URL}/stats`),
      fetch(`${VM_URL}/traces`)
    ]);
    const statsJson = await statsRes.json();
    const tracesJson: Trace[] = await tracesRes.json();
    setStats(statsJson);

    // flatten all claims across all traces into scatter points
    const points: ScatterPoint[] = [];
    for (const trace of tracesJson) {
      if (!trace.claims?.length) continue;
      for (const claim of trace.claims) {
        points.push({
          x: claim.accuracy,
          y: claim.confidence,
          text: claim.text,
          agent: trace.agent_name,
          danger: claim.confidence > 0.7 && claim.accuracy < 0.4,
        });
      }
    }
    setScatterData(points);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const blockRate = stats && stats.total_traces > 0
    ? ((stats.guardrail_blocks / stats.total_traces) * 100).toFixed(1)
    : "0";

  const dangerPoints = scatterData.filter(p => p.danger);
  const safePoints = scatterData.filter(p => !p.danger);

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 40px' }} className="fade-in">

      <div className="mb-12">
        <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Live Pipeline</p>
        <h1 className="mono text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>Mission Control</h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>Telemetry refreshes every 10 seconds</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }}>
        {[
          { label: "Total Traces", value: stats?.total_traces ?? "—", sub: "agent calls logged", danger: false },
          { label: "Guardrail Blocks", value: stats?.guardrail_blocks ?? "—", sub: `${blockRate}% block rate`, danger: true },
          { label: "Danger Zone Claims", value: stats?.total_danger_zone ?? "—", sub: "high confidence hallucinations", danger: true },
          { label: "Avg Latency", value: stats ? `${stats.avg_latency_ms}ms` : "—", sub: "per agent call", danger: false },
        ].map((card) => (
          <div key={card.label} className="rounded-xl p-6 flex flex-col gap-4" style={{
            background: 'var(--surface)',
            border: `1px solid ${card.danger ? 'rgba(255,59,59,0.4)' : 'var(--border)'}`,
            boxShadow: card.danger ? '0 0 24px rgba(255,59,59,0.08)' : 'none'
          }}>
            <p className="mono text-xs uppercase tracking-widest" style={{ color: card.danger ? 'var(--accent)' : 'var(--text-muted)' }}>{card.label}</p>
            <p className="mono font-bold leading-none" style={{ fontSize: '2.5rem', color: card.danger ? 'var(--accent)' : 'var(--text-primary)' }}>{card.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Scatter Plot */}
      <div className="rounded-xl p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Hallucination Map</p>
            <h2 className="mono text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Confidence vs Accuracy</h2>
          </div>
          <div className="flex gap-5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: '#ff3b3b' }}>● danger zone</span>
            <span style={{ color: '#00ff88' }}>● safe</span>
          </div>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Each dot is a factual claim extracted from an AI response. Top-left quadrant = the model was confident about something it got wrong.
        </p>

        {scatterData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="mono text-sm" style={{ color: 'var(--text-muted)' }}>Run the pipeline to see claims appear here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                type="number" dataKey="x" domain={[0, 1]} name="Accuracy"
                label={{ value: 'Accuracy →', position: 'insideBottom', offset: -10, fill: '#444', fontSize: 11, fontFamily: 'Space Mono' }}
                tick={{ fill: '#444', fontSize: 10, fontFamily: 'Space Mono' }}
                stroke="#222"
              />
              <YAxis
                type="number" dataKey="y" domain={[0, 1]} name="Confidence"
                label={{ value: 'Confidence', angle: -90, position: 'insideLeft', fill: '#444', fontSize: 11, fontFamily: 'Space Mono' }}
                tick={{ fill: '#444', fontSize: 10, fontFamily: 'Space Mono' }}
                stroke="#222"
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Danger zone boundary lines */}
              <ReferenceLine x={0.4} stroke="rgba(255,59,59,0.2)" strokeDasharray="4 4" />
              <ReferenceLine y={0.7} stroke="rgba(255,59,59,0.2)" strokeDasharray="4 4" />

              {/* Safe claims */}
              <Scatter data={safePoints} fillOpacity={0.7}>
                {safePoints.map((_, i) => <Cell key={i} fill="#00ff88" />)}
              </Scatter>

              {/* Danger zone claims rendered on top */}
              <Scatter data={dangerPoints} fillOpacity={0.9}>
                {dangerPoints.map((_, i) => <Cell key={i} fill="#ff3b3b" />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {dangerPoints.length > 0 && (
          <div className="mt-6 rounded-lg p-4" style={{ background: 'rgba(255,59,59,0.05)', border: '1px solid rgba(255,59,59,0.2)' }}>
            <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: '#ff3b3b' }}>⚠ Danger Zone Claims Detected</p>
            <div className="flex flex-col gap-2">
              {dangerPoints.map((p, i) => (
                <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  <span className="mono" style={{ color: '#ff3b3b' }}>{p.agent}</span> — {p.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

    </main>
  );
}