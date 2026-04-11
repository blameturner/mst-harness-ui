import { createFileRoute, isRedirect, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';
import { FormInput } from '../components/FormInput';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? 'Invalid email or password');
        return;
      }
      await navigate({ to: '/chat' });
    } catch (err) {
      setError((err as Error)?.message ?? 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3 font-sans">
          · Sign in ·
        </p>
        <h1 className="font-display text-5xl font-semibold tracking-tightest leading-none mb-10">
          Jeff<span className="italic">GPT</span>
        </h1>
        <form onSubmit={onSubmit} className="space-y-5">
          <FormInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-xs font-sans">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-fg text-bg font-medium tracking-wide py-3 rounded-md hover:bg-fg/85 transition-colors disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    let status: { configured: boolean };
    try {
      status = await setupStatus();
    } catch {
      return;
    }
    if (!status.configured) {
      throw redirect({ to: '/setup' });
    }
  },
  component: LoginPage,
  errorComponent: ({ error }) => {
    if (isRedirect(error)) throw error;
    return <p className="text-red-600 p-8">Failed to load login page.</p>;
  },
});
