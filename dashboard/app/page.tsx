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

    const chart = tracesJson.slice().reverse().map((t, i) => ({
      index: i + 1,
      tokens: t.tokens_used,
      latency: t.latency_ms,
    }));
    setChartData(chart);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const blockRate = stats ? ((stats.guardrail_blocks / stats.total_traces) * 100).toFixed(1) : "0";

  return (
    <main className="p-8 fade-in">
      <div className="mb-10">
        <h1 className="mono text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Mission Control</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Live telemetry — refreshes every 10s</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Traces", value: stats?.total_traces ?? "—", sub: "agent calls logged" },
          { label: "Guardrail Blocks", value: stats?.guardrail_blocks ?? "—", accent: true, sub: `${blockRate}% block rate` },
          { label: "Avg Latency", value: stats ? `${stats.avg_latency_ms}ms` : "—", sub: "per agent call" },
          { label: "Tokens Burned", value: stats?.total_tokens?.toLocaleString() ?? "—", sub: "total across all traces" },
        ].map((card) => (
          <div key={card.label} className="p-6 rounded-lg border" style={{ background: 'var(--surface)', borderColor: card.accent ? 'var(--accent)' : 'var(--border)' }}>
            <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: card.accent ? 'var(--accent)' : 'var(--text-muted)' }}>{card.label}</p>
            <p className="mono text-4xl font-bold mb-1" style={{ color: card.accent ? 'var(--accent)' : 'var(--text-primary)' }}>{card.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="mono text-xs uppercase tracking-widest mb-6" style={{ color: 'var(--text-muted)' }}>Token Burn per Call</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="index" stroke="#333" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis stroke="#333" tick={{ fill: '#555', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 6, color: '#f0f0f0', fontFamily: 'Space Mono' }} />
              <Line type="monotone" dataKey="tokens" stroke="#00ff88" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="mono text-xs uppercase tracking-widest mb-6" style={{ color: 'var(--text-muted)' }}>Latency per Call (ms)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="index" stroke="#333" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis stroke="#333" tick={{ fill: '#555', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 6, color: '#f0f0f0', fontFamily: 'Space Mono' }} />
              <Line type="monotone" dataKey="latency" stroke="#ff3b3b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </main>
  );
}