// Supabase is used in the browser only for Google/Facebook sign-in. After the
// provider redirects back, the Supabase session is exchanged for the shop's
// own session (POST /api/auth/oauth) and then discarded.
let clientPromise;

export function getSupabase(config) {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.anonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, persistSession: true },
    }),
  );
  return clientPromise;
}

export async function startSocialLogin(config, provider, next = '/account') {
  const sb = await getSupabase(config);
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  // Facebook only shares the email when asked for it explicitly.
  const scopes = provider === 'facebook' ? 'email' : undefined;
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo, scopes } });
  if (error) throw error;
}
