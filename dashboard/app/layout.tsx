import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panopticon — LLM Hallucination Auditor",
  description: "Detects when AI is confidently wrong",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(7,10,18,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '0 32px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="live-dot" style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'var(--red)', flexShrink: 0
            }} />
            <span className="display" style={{
              fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text)'
            }}>Panopticon</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[
              { label: 'Mission Control', href: '/' },
              { label: 'Trace Log', href: '/traces' },
            ].map(({ label, href }) => (
              <a key={href} href={href} className="nav-link">{label}</a>
            ))}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}