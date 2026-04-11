import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { setupStatus } from '../api/auth/setupStatus';
import { setup } from '../api/auth/setup';
import { FormInput } from '../components/FormInput';
import { slugify } from '../utils/slugify';

function SetupPage() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await setup({ orgName, slug: slug || slugify(orgName), email, password, displayName });
      navigate({ to: '/login' });
    } catch (err: any) {
      setError(await toUserError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toUserError(err: any): Promise<string> {
    const messages: Record<string, string> = {
      already_configured: 'This system has already been set up. Please sign in.',
      invalid_body: 'Please check the form fields and try again.',
      setup_failed: 'Setup failed. Please try again.',
      create_org_failed: 'Could not create organisation. Please try again.',
      create_user_failed: 'Could not create user. Please try again.',
      auth_signup_failed: 'Could not create account. Please try again.',
      rate_limited: 'Too many attempts. Please wait and try again.',
    };
    try {
      const payload = await err?.response?.json?.();
      const code = payload?.error;
      if (typeof code === 'string' && messages[code]) return messages[code];
    } catch {}
    return 'Setup failed. Please try again.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-md">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3 font-sans">
          · First run ·
        </p>
        <h1 className="font-display text-5xl font-semibold tracking-tightest leading-none mb-3">
          Jeff<span className="italic">GPT</span>
        </h1>
        <p className="text-muted mb-1">Create your organisation to get started.</p>
        <p className="text-muted text-xs mb-8 font-sans">
          Already have an account?{' '}
          <Link to="/login" className="text-fg hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <FormInput
            label="Organisation name"
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value);
              if (!slugDirty) setSlug(slugify(e.target.value));
            }}
            required
          />
          <FormInput
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugDirty(true);
            }}
            required
          />
          <FormInput
            label="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
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
            minLength={8}
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
            {busy ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    let status: { configured: boolean };
    try {
      status = await setupStatus();
    } catch {
      return;
    }
    if (status.configured) {
      throw redirect({ to: '/login' });
    }
  },
  component: SetupPage,
});
