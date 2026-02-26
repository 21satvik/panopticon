"use client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const VM_URL = "http://130.162.162.122:8000";

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
    fetch(`${VM_URL}/traces`)
      .then(r => r.json())
      .then(setTraces);
  }, []);

  return (
    <main className="p-8 fade-in">
      <div className="mb-10">
        <h1 className="mono text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Trace Log</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click any row to inspect the full trace</p>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              {["Agent", "Prompt", "Tokens", "Latency", "Status", "Time"].map(h => (
                <th key={h} className="mono text-left text-xs uppercase tracking-widest px-4 py-3" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traces.map((trace, i) => (
              <tr
                key={trace.trace_id}
                onClick={() => setSelected(trace)}
                className="border-b cursor-pointer transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border)',
                  background: i % 2 === 0 ? 'var(--surface)' : 'var(--background)',
                }}
              >
                <td className="mono text-xs px-4 py-3" style={{ color: 'var(--text-muted)' }}>{trace.agent_name}</td>
                <td className="text-sm px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{trace.prompt}</td>
                <td className="mono text-xs px-4 py-3" style={{ color: 'var(--accent-green)' }}>{trace.tokens_used}</td>
                <td className="mono text-xs px-4 py-3" style={{ color: 'var(--text-primary)' }}>{trace.latency_ms}ms</td>
                <td className="px-4 py-3">
                  <span className="mono text-xs px-2 py-1 rounded" style={{
                    background: trace.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.15)' : 'rgba(0,255,136,0.1)',
                    color: trace.guardrail_status === 'BLOCK' ? 'var(--accent)' : 'var(--accent-green)',
                  }}>
                    {trace.guardrail_status}
                  </span>
                </td>
                <td className="mono text-xs px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {new Date(trace.created_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trace Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent side="right" className="w-[580px] overflow-y-auto border-l" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {selected && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="mono text-sm uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Trace Inspector</SheetTitle>
                <div className="flex items-center gap-2 mt-2">
                  <span className="mono text-xs px-2 py-1 rounded" style={{
                    background: selected.guardrail_status === 'BLOCK' ? 'rgba(255,59,59,0.15)' : 'rgba(0,255,136,0.1)',
                    color: selected.guardrail_status === 'BLOCK' ? 'var(--accent)' : 'var(--accent-green)',
                  }}>{selected.guardrail_status}</span>
                  <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{selected.agent_name}</span>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {[
                  { label: "Prompt", content: selected.prompt },
                  { label: "Response", content: selected.response },
                ].map(({ label, content }) => (
                  <div key={label}>
                    <p className="mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <div className="rounded p-4 text-sm leading-relaxed" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {content}
                    </div>
                  </div>
                ))}

                <div className="rounded p-4" style={{ background: 'rgba(255,59,59,0.05)', border: `1px solid ${selected.guardrail_status === 'BLOCK' ? 'var(--accent)' : 'var(--border)'}` }}>
                  <p className="mono text-xs uppercase tracking-widest mb-2" style={{ color: selected.guardrail_status === 'BLOCK' ? 'var(--accent)' : 'var(--text-muted)' }}>Judge Reasoning</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selected.guardrail_reasoning}</p>
                  <p className="mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Score: {selected.guardrail_score}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Tokens Used", value: selected.tokens_used },
                    { label: "Latency", value: `${selected.latency_ms}ms` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded p-3" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <p className="mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}