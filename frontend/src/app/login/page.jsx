'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/api';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
      return;
    }
    setError('Invalid email or password. Please try again.');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl grid items-center gap-12 lg:grid-cols-[1fr_420px]">

        <section className="hidden lg:block space-y-5">
          <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-100">✈ Trao Travel Planner</span>
          <h1 className="text-4xl font-black text-slate-900 leading-tight">
            Continue planning<br />your next adventure.
          </h1>
          <p className="text-slate-500 leading-relaxed max-w-sm">
            Access your trips, regenerate daily plans, and keep your packing progress up to date.
          </p>
          <div className="flex items-center gap-4 pt-2">
            {['🗺️ Itineraries', '🔄 Regenerate days', '🎒 Packing lists'].map(f => (
              <span key={f} className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">{f}</span>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="card w-full space-y-5 p-8">
          <div>
            <div className="text-2xl font-black text-slate-900">Welcome back 👋</div>
            <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>
          </div>
          <div className="space-y-3">
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
          <button className="btn-primary w-full py-3">Sign in</button>
          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link className="font-semibold text-indigo-600 hover:text-indigo-700" href="/register">Create one free →</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
