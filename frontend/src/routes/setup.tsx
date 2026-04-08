import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../lib/api';
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
      await api.setup({ orgName, slug: slug || slugify(orgName), email, password, displayName });
      navigate({ to: '/login' });
    } catch (err: any) {
      setError(await toUserError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toUserError(err: any): Promise<string> {
    // Map known API error codes to friendly copy; don't render raw backend text.
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
    } catch {
      // fall through
    }
    return 'Setup failed. Please try again.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold mb-1">
          Welcome to <span className="text-accent">JeffGPT</span>
        </h1>
        <p className="text-muted mb-8">Create your organisation to get started.</p>

        <form onSubmit={onSubmit} className="space-y-4">
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-bg font-semibold py-2.5 rounded-md hover:bg-amber-400 transition disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/setup')({ component: SetupPage });
