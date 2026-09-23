import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthErrorCode =
  | 'invalid_email'
  | 'weak_password'
  | 'account_exists'
  | 'incorrect_credentials'
  | 'email_confirmation_required'
  | 'network'
  | 'unknown';

export type AuthServiceError = {
  code: AuthErrorCode;
  message: string;
  debugMessage?: string;
};

export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthServiceError };

export type AuthSessionState = { user: User | null; session: Session | null };
export type SignUpData = AuthSessionState & { requiresEmailConfirmation: boolean };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown authentication error';
}

function toAuthError(error: unknown, action: 'sign-in' | 'sign-up' | 'sign-out' | 'session'): AuthServiceError {
  const message = errorMessage(error);
  const normalized = message.toLowerCase();
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLowerCase()
    : '';

  if (/invalid email|email address.*invalid|email.*format/.test(normalized) || code === 'email_address_invalid') {
    return { code: 'invalid_email', message: 'Enter a valid email address.', debugMessage: message };
  }
  if (/password.*(weak|short|at least)|weak password/.test(normalized) || code === 'weak_password') {
    return { code: 'weak_password', message: 'Choose a stronger password that meets the password requirements.', debugMessage: message };
  }
  if (/already registered|already exists|user already|email.*taken/.test(normalized) || code === 'user_already_exists') {
    return { code: 'account_exists', message: 'An account with this email already exists. Try signing in.', debugMessage: message };
  }
  if (/invalid login credentials|invalid credentials|email or password/.test(normalized) || code === 'invalid_credentials') {
    return { code: 'incorrect_credentials', message: 'Email or password is incorrect.', debugMessage: message };
  }
  if (/email not confirmed|confirm your email|email confirmation/.test(normalized) || code === 'email_not_confirmed') {
    return { code: 'email_confirmation_required', message: 'Confirm your email address before signing in.', debugMessage: message };
  }
  if (/network|fetch failed|failed to fetch|timeout|connection/.test(normalized) || error instanceof TypeError) {
    return { code: 'network', message: 'Could not reach the authentication service. Check your connection and try again.', debugMessage: message };
  }
  const actionMessage = action === 'sign-out'
    ? 'Could not sign out. Please try again.'
    : action === 'session'
      ? 'Could not restore your session. Please try again.'
      : 'Authentication could not be completed. Please try again.';
  return { code: 'unknown', message: actionMessage, debugMessage: message };
}

export const authRepository = {
  async signUp(email: string, password: string): Promise<AuthResult<SignUpData>> {
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return { data: null, error: toAuthError(error, 'sign-up') };
      return {
        data: {
          user: data.user,
          session: data.session,
          requiresEmailConfirmation: Boolean(data.user && !data.session),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: toAuthError(error, 'sign-up') };
    }
  },

  async signIn(email: string, password: string): Promise<AuthResult<AuthSessionState>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { data: null, error: toAuthError(error, 'sign-in') };
      return { data: { user: data.user, session: data.session }, error: null };
    } catch (error) {
      return { data: null, error: toAuthError(error, 'sign-in') };
    }
  },

  async signOut(): Promise<AuthResult<null>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { data: null, error: toAuthError(error, 'sign-out') };
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: toAuthError(error, 'sign-out') };
    }
  },

  async getSession(): Promise<AuthResult<AuthSessionState>> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { data: null, error: toAuthError(error, 'session') };
      return { data: { user: data.session?.user ?? null, session: data.session }, error: null };
    } catch (error) {
      return { data: null, error: toAuthError(error, 'session') };
    }
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  },
};
