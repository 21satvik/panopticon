import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panopticon",
  description: "LLM Observability Pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'var(--background)' }}>
        <nav className="border-b px-8 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full pulse-red" style={{ background: 'var(--accent)' }} />
            <span className="mono text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--text-primary)' }}>Panopticon</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/" className="mono text-xs tracking-wider uppercase hover:opacity-100 opacity-50 transition-opacity" style={{ color: 'var(--text-primary)' }}>Mission Control</a>
            <a href="/traces" className="mono text-xs tracking-wider uppercase hover:opacity-100 opacity-50 transition-opacity" style={{ color: 'var(--text-primary)' }}>Trace Log</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}