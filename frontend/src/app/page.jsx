import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-black text-indigo-600 tracking-tight">✈ Trao</span>
          <div className="flex items-center gap-3">
            <Link className="btn-ghost" href="/login">Login</Link>
            <Link className="btn-primary" href="/register">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-100 mb-4">
          🌍 AI-Powered Travel Planner
        </span>
        <h1 className="mt-4 text-5xl font-black text-slate-900 leading-tight sm:text-6xl">
          Plan your perfect trip<br />
          <span className="text-indigo-600">in seconds with AI.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Generate full itineraries, customize any day, and manage your packing list — all in one clean workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="btn-primary px-7 py-3 text-base" href="/register">Start planning →</Link>
          <Link className="btn-secondary px-7 py-3 text-base" href="/login">Sign in</Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: '🗺️', color: 'bg-indigo-50 text-indigo-600', title: 'Instant Itineraries', desc: 'Full day-by-day plans generated in seconds based on your budget, duration, and interests.' },
            { icon: '🔄', color: 'bg-emerald-50 text-emerald-600', title: 'Regenerate Any Day', desc: 'Give feedback and refresh just one day instantly without rebuilding the whole trip.' },
            { icon: '🎒', color: 'bg-violet-50 text-violet-600', title: 'Smart Packing Lists', desc: 'Auto-generated packing lists organized by category with progress tracking.' },
          ].map((f) => (
            <div key={f.title} className="card p-6 hover:shadow-md transition">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${f.color}`}>{f.icon}</span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
