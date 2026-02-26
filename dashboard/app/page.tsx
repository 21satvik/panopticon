"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const VM_URL = "http://130.162.162.122:8000";

interface Stats {
  total_traces: number;
  guardrail_blocks: number;
  avg_latency_ms: number;
  total_tokens: number;
}

interface Trace {
  trace_id: string;
  created_at: string;
  tokens_used: number;
  latency_ms: number;
  guardrail_status: string;
}

export default function MissionControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchData = async () => {
    const [statsRes, tracesRes] = await Promise.all([
      fetch(`${VM_URL}/stats`),
      fetch(`${VM_URL}/traces`)
    ]);
    const statsJson = await statsRes.json();
    const tracesJson: Trace[] = await tracesRes.json();
    setStats(statsJson);
    setChartData(tracesJson.slice().reverse().map((t, i) => ({
      index: i + 1,
      tokens: t.tokens_used,
      latency: t.latency_ms,
    })));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const blockRate = stats ? ((stats.guardrail_blocks / stats.total_traces) * 100).toFixed(1) : "0";

  return (
    <main className="max-w-6xl mx-auto px-8 py-12 fade-in">

      {/* Header */}
      <div className="mb-12">
        <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Live Pipeline</p>
        <h1 className="mono text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>Mission Control</h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>Telemetry refreshes every 10 seconds</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5 mb-12">
        {[
          { label: "Total Traces", value: stats?.total_traces ?? "—", sub: "agent calls logged", accent: false },
          { label: "Guardrail Blocks", value: stats?.guardrail_blocks ?? "—", sub: `${blockRate}% block rate`, accent: true },
          { label: "Avg Latency", value: stats ? `${stats.avg_latency_ms}ms` : "—", sub: "per agent call", accent: false },
          { label: "Tokens Burned", value: stats?.total_tokens?.toLocaleString() ?? "—", sub: "cumulative total", accent: false },
        ].map((card) => (
          <div key={card.label} className="rounded-xl p-6 flex flex-col gap-4" style={{
            background: 'var(--surface)',
            border: `1px solid ${card.accent ? 'var(--accent)' : 'var(--border)'}`,
            boxShadow: card.accent ? '0 0 24px rgba(255,59,59,0.08)' : 'none'
          }}>
            <p className="mono text-xs uppercase tracking-widest" style={{ color: card.accent ? 'var(--accent)' : 'var(--text-muted)' }}>{card.label}</p>
            <p className="mono font-bold leading-none" style={{ fontSize: '2.5rem', color: card.accent ? 'var(--accent)' : 'var(--text-primary)' }}>{card.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        {[
          { title: "Token Burn", key: "tokens", color: "#00ff88" },
          { title: "Latency (ms)", key: "latency", color: "#ff3b3b" },
        ].map(({ title, key, color }) => (
          <div key={title} className="rounded-xl p-7" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mono text-xs uppercase tracking-widest mb-8" style={{ color: 'var(--text-muted)' }}>{title}</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="index" stroke="#222" tick={{ fill: '#444', fontSize: 10, fontFamily: 'Space Mono' }} />
                <YAxis stroke="#222" tick={{ fill: '#444', fontSize: 10, fontFamily: 'Space Mono' }} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, color: '#f0f0f0', fontFamily: 'Space Mono', fontSize: 12 }} />
                <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </main>
  );
}