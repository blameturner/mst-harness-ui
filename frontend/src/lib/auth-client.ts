import { createAuthClient } from 'better-auth/react';
import { gatewayUrl } from './runtime-env';

export const authClient = createAuthClient({
  baseURL: gatewayUrl(),
  fetchOptions: { credentials: 'include' },
});

export const { signIn, signOut, useSession } = authClient;
