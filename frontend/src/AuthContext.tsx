import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { setUserContext, clearUserContext } from './utils/sentry';
import { setTokenGetter } from './api';
import { logger } from './utils/logger';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components -- Hook export alongside Provider is intentional
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState(null); // Track auth events like PASSWORD_RECOVERY
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false); // Persist password reset state

  // Mutex to prevent concurrent token refresh race conditions
  const refreshingPromiseRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session (this also processes any tokens in the URL hash)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(err => {
        logger.error('Failed to get session:', err);
        setLoading(false);
      });

    // Listen for auth changes - this handles magic links, password recovery, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Auth state changed:', event, session?.user?.email);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAuthEvent(event);

      // Update Sentry user context
      if (currentUser) {
        setUserContext(currentUser);
      } else {
        clearUserContext();
      }

      // If we get a PASSWORD_RECOVERY event, set the flag (persists until password is updated)
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
      }

      // Clear the URL hash after processing auth tokens
      if (window.location.hash && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) {
        // Use replaceState to remove hash without triggering a reload
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signOut();
    // Ignore AuthSessionMissingError - this just means we're already signed out
    // This commonly happens on mobile when tokens have expired
    if (error && error.name !== 'AuthSessionMissingError') {
      throw error;
    }
    // Clear local state regardless
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    // Clear the password reset flag after successful update
    setNeedsPasswordReset(false);
  }, []);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;

    // First try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession();

    // If we have a session but the token might be expired, try to refresh
    if (session?.access_token) {
      // Check if token is about to expire (within 60 seconds)
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt && expiresAt - now < 60) {
        // Token is expired or about to expire, refresh it
        // Use mutex to prevent concurrent refresh race conditions
        if (refreshingPromiseRef.current) {
          // Another refresh is already in progress, wait for it
          return refreshingPromiseRef.current;
        }

        // Start a new refresh and store the promise
        refreshingPromiseRef.current = (async () => {
          try {
            const { data: refreshData } = await supabase.auth.refreshSession();
            return refreshData?.session?.access_token ?? session.access_token;
          } finally {
            refreshingPromiseRef.current = null;
          }
        })();

        return refreshingPromiseRef.current;
      }

      return session.access_token;
    }

    // No session, try to refresh in case there's a valid refresh token
    if (!session && !error) {
      // Use mutex for this refresh path as well
      if (refreshingPromiseRef.current) {
        return refreshingPromiseRef.current;
      }

      refreshingPromiseRef.current = (async () => {
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          return refreshData?.session?.access_token ?? null;
        } finally {
          refreshingPromiseRef.current = null;
        }
      })();

      return refreshingPromiseRef.current;
    }

    return null;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  // Set the API token getter immediately so child components can make authenticated requests
  // This must happen before children render, so we do it synchronously in the component body
  setTokenGetter(getAccessToken);

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const value = useMemo(() => ({
    user,
    loading,
    authEvent,
    needsPasswordReset,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    getAccessToken,
    isAuthenticated: !!user,
  }), [user, loading, authEvent, needsPasswordReset, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, getAccessToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
