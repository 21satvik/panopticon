"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';

const VM_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Trace {
  trace_id: string;
  session_id: string;
  agent_name: string;
  prompt: string;
  response: string;
  tokens_used: number;
  latency_ms: number;
  guardrail_status: string;
  guardrail_score: number;
  guardrail_reasoning: string;
  created_at: string;
}

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selected, setSelected] = useState<Trace | null>(null);

  useEffect(() => {
    fetch(`${VM_URL}/traces`).then(r => r.json()).then(setTraces);
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-8 py-12 fade-in">
      <div className="mb-12">
        <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Observability</p>
        <h1 className="mono text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>Trace Log</h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>Click any row to inspect the full trace</p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {["Agent", "Prompt", "Tokens", "Latency", "Status", "Time"].map(h => (
                <th key={h} className="mono text-left text-xs uppercase tracking-widest px-6 py-4" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traces.map((trace, i) => (
              <tr
                key={trace.trace_id}
                onClick={() => setSelected(trace)}
                className="cursor-pointer transition-all duration-150"
                style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--background)', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--background)')}
              >
                <td className="mono text-xs px-6 py-4" style={{ color: 'var(--text-muted)' }}>{trace.agent_name}</td>
                <td className="text-sm px-6 py-4 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{trace.prompt}</td>
                <td className="mono text-xs px-6 py-4" style={{ color: 'var(--accent-green)' }}>{trace.tokens_used}</td>
                <td className="mono text-xs px-6 py-4" style={{ color: 'var(--text-primary)' }}>{trace.latency_ms}ms</td>
                <td className="px-6 py-4">
                  <span className="mono text-xs px-3 py-1 rounded-full" style={{
                    background: trace.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.15)' : 'rgba(0,255,136,0.1)',
                    color: trace.guardrail_status === 'BLOCK' ? '#ff3b3b' : '#00ff88',
                  }}>{trace.guardrail_status}</span>
                </td>
                <td className="mono text-xs px-6 py-4" style={{ color: 'var(--text-muted)' }}>{new Date(trace.created_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="drawer-backdrop" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelected(null)} />
          <div className="drawer-panel overflow-y-auto" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: '40px 36px' }}>
            <button onClick={() => setSelected(null)} className="absolute top-6 right-6 mono text-xs uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-primary)' }}>✕ close</button>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="mono text-xs px-3 py-1 rounded-full" style={{
                  background: selected.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.15)' : 'rgba(0,255,136,0.1)',
                  color: selected.guardrail_status === 'BLOCK' ? '#ff3b3b' : '#00ff88',
                }}>{selected.guardrail_status}</span>
                <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{selected.agent_name}</span>
              </div>
              <h2 className="mono text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Trace Inspector</h2>
              <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{selected.trace_id}</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Tokens Used", value: selected.tokens_used },
                  { label: "Latency", value: `${selected.latency_ms}ms` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                    <p className="mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="mono text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg p-5" style={{
                background: selected.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.05)' : 'rgba(0,255,136,0.04)',
                border: `1px solid ${selected.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.25)' : 'rgba(0,255,136,0.2)'}`,
              }}>
                <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: selected.guardrail_status === 'BLOCK' ? '#ff3b3b' : '#00ff88' }}>Judge Reasoning</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{selected.guardrail_reasoning}</p>
                <p className="mono text-xs mt-3" style={{ color: 'var(--text-muted)' }}>confidence score: {selected.guardrail_score}</p>
              </div>

              <div>
                <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Prompt</p>
                <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {selected.prompt}
                </div>
              </div>

              <div>
                <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Response</p>
                <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto' }}>
                  <ReactMarkdown>{selected.response}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}