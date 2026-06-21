'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/api';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
      return;
    }
    setError('Unable to create account. Please review details and try again.');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl grid items-center gap-12 lg:grid-cols-[1fr_420px]">

        <section className="hidden lg:block space-y-5">
          <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">🌍 New here</span>
          <h1 className="text-4xl font-black text-slate-900 leading-tight">
            Start planning smarter<br />trips with AI.
          </h1>
          <p className="text-slate-500 leading-relaxed max-w-sm">
            Create an account and generate your first AI travel itinerary in under a minute.
          </p>
          <div className="flex items-center gap-4 pt-2">
            {['Free to use', 'No credit card', 'Instant results'].map(f => (
              <span key={f} className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">✓ {f}</span>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="card w-full space-y-5 p-8">
          <div>
            <div className="text-2xl font-black text-slate-900">Create account 🚀</div>
            <p className="mt-1 text-sm text-slate-500">Plan your next trip in minutes.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Full Name</label>
              <input className="field" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
              <input className="field" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
              <input className="field" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <button className="btn-primary w-full py-3">Create account</button>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link className="font-semibold text-indigo-600 hover:text-indigo-700" href="/login">Sign in →</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
