"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';

const VM_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Claim {
  text: string;
  confidence: number;
  accuracy: number;
  supported: boolean;
  issue: string | null;
}

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
  claims: Claim[];
  danger_zone_count: number;
  created_at: string;
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="progress-track" style={{ flex: 1 }}>
      <div className="progress-fill" style={{ width: `${value * 100}%`, background: color }} />
    </div>
  );
}

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selected, setSelected] = useState<Trace | null>(null);

  useEffect(() => {
    fetch(`${VM_URL}/traces`).then(r => r.json()).then(setTraces);
  }, []);

  return (
    <main style={{ maxWidth: '1160px', margin: '0 auto', padding: '48px 32px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: '36px' }}>
        <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '10px' }}>
          ◆ Observability
        </p>
        <h1 className="display" style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.1, marginBottom: '8px' }}>
          Trace Log
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Click any row to inspect claims and hallucination scores</p>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, var(--border-2), transparent)', marginTop: '28px' }} />
      </div>

      {/* Table */}
      <div className="card fade-up-1" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              {['Agent', 'Prompt', 'Claims', 'Danger Zone', 'Status', 'Time'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traces.map(trace => (
              <tr key={trace.trace_id} onClick={() => setSelected(trace)}>
                <td>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.02em' }}>
                    {trace.agent_name.replace('_agent', '')}
                  </span>
                </td>
                <td style={{ maxWidth: '220px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trace.prompt}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--text-2)' }}>{trace.claims?.length ?? 0}</span>
                </td>
                <td>
                  {trace.danger_zone_count > 0
                    ? <span className="badge badge-danger">⚠ {trace.danger_zone_count}</span>
                    : <span className="mono" style={{ fontSize: '12px', color: 'var(--text-3)' }}>—</span>
                  }
                </td>
                <td>
                  <span className={`badge ${trace.guardrail_status === 'BLOCK' ? 'badge-block' : 'badge-pass'}`}>
                    {trace.guardrail_status}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    {new Date(trace.created_at).toLocaleTimeString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selected && (
        <>
          <div className="drawer-backdrop" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelected(null)} />
          <div className="drawer-panel" style={{ padding: '36px 32px', overflowY: 'auto' }}>

            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span className={`badge ${selected.guardrail_status === 'BLOCK' ? 'badge-block' : 'badge-pass'}`}>
                    {selected.guardrail_status}
                  </span>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {selected.agent_name.replace('_agent', '')} agent
                  </span>
                  {selected.danger_zone_count > 0 && (
                    <span className="badge badge-danger">⚠ {selected.danger_zone_count} hallucination{selected.danger_zone_count > 1 ? 's' : ''}</span>
                  )}
                </div>
                <h2 className="display" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  Trace Inspector
                </h2>
                <p className="mono" style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                  {selected.trace_id}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px',
                padding: '6px 10px', cursor: 'pointer', color: 'var(--text-2)',
                fontFamily: 'JetBrains Mono', fontSize: '11px', letterSpacing: '0.04em',
                transition: 'all 0.15s', flexShrink: 0
              }}>✕</button>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', marginBottom: '24px' }} />

            {/* Metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Tokens Used', value: selected.tokens_used },
                { label: 'Latency', value: `${selected.latency_ms}ms` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>{label}</p>
                  <p className="display" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Judge verdict */}
            <div style={{
              background: selected.guardrail_status === 'BLOCK' ? 'rgba(255,68,68,0.04)' : 'rgba(0,212,160,0.04)',
              border: `1px solid ${selected.guardrail_status === 'BLOCK' ? 'rgba(255,68,68,0.2)' : 'rgba(0,212,160,0.2)'}`,
              borderRadius: '8px', padding: '16px 18px', marginBottom: '20px'
            }}>
              <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: selected.guardrail_status === 'BLOCK' ? 'var(--red)' : 'var(--teal)', marginBottom: '8px' }}>
                Judge Verdict
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>{selected.guardrail_reasoning}</p>
            </div>

            {/* Claims */}
            {selected.claims?.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px' }}>
                  Claim Analysis — {selected.claims.length} extracted
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selected.claims.map((claim, i) => {
                    const isDanger = claim.confidence > 0.7 && claim.accuracy < 0.4;
                    return (
                      <div key={i} style={{
                        background: isDanger ? 'rgba(255,68,68,0.04)' : 'var(--surface)',
                        border: `1px solid ${isDanger ? 'rgba(255,68,68,0.25)' : 'var(--border)'}`,
                        borderRadius: '8px', padding: '14px 16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          {isDanger && <span className="badge badge-danger">⚠ Danger Zone</span>}
                          {!isDanger && claim.supported && <span className="badge badge-pass">✓ Supported</span>}
                          {!isDanger && !claim.supported && (
                            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>~ Unsupported</span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.6, marginBottom: claim.issue ? '6px' : '12px' }}>{claim.text}</p>
                        {claim.issue && (
                          <p style={{ fontSize: '11px', color: 'var(--red)', fontStyle: 'italic', marginBottom: '12px', opacity: 0.8 }}>{claim.issue}</p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {[
                            { label: 'Confidence', val: claim.confidence, color: isDanger ? 'var(--red)' : 'var(--text-3)' },
                            { label: 'Accuracy', val: claim.accuracy, color: claim.accuracy > 0.6 ? 'var(--teal)' : 'var(--red)' },
                          ].map(({ label, val, color }) => (
                            <div key={label}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span className="mono" style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                                <span className="mono" style={{ fontSize: '10px', color, fontWeight: 500 }}>{(val * 100).toFixed(0)}%</span>
                              </div>
                              <Bar value={val} color={color} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div style={{ marginBottom: '16px' }}>
              <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Prompt</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
                {selected.prompt}
              </div>
            </div>

            {/* Response */}
            <div>
              <p className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Response</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '12px', color: 'var(--text)', lineHeight: 1.7, maxHeight: '280px', overflowY: 'auto' }}>
                <ReactMarkdown>{selected.response}</ReactMarkdown>
              </div>
            </div>

          </div>
        </>
      )}
    </main>
  );
}