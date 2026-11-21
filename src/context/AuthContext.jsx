import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, PASSWORD_CHANGE_REQUIRED_EVENT, SESSION_EXPIRED_EVENT } from '../api/client';
import { readSession, writeSession, clearSession } from '../api/session';
import { ROLES, userCan } from '../config/permissions';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const AuthContext = createContext(null);

function toSession({ token, user, organization }) {
  return { token, user, organization };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [previousUserId, setPreviousUserId] = useState(null);

  const startSession = useCallback((payload) => {
    const next = toSession(payload);
    writeSession(next);
    setSession(next);
    setSessionExpired(false);
    return next;
  }, []);

  const updateSession = useCallback(
    (changes) => {
      if (!session) return;
      const next = toSession({ ...session, ...changes });
      writeSession(next);
      setSession(next);
    },
    [session]
  );

  const currentUserId = session?.user?.id ?? null;

  const endSession = useCallback(() => {
    setPreviousUserId(currentUserId);
    clearSession();
    setSession(null);
  }, [currentUserId]);

  useEffect(() => {
    function handleExpired() {
      setSessionExpired(true);
      endSession();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [endSession]);

  // The server refused a request because a temporary password is still in use.
  useEffect(() => {
    function handlePasswordChangeRequired() {
      setSession((current) => {
        if (!current?.user || current.user.mustChangePassword) return current;
        const next = { ...current, user: { ...current.user, mustChangePassword: true } };
        writeSession(next);
        return next;
      });
    }
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
    return () => window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
  }, []);

  // The Admin may change someone's sites or access while they are signed in, so the session is refreshed when the app
  // opens, when the tab comes back into view, and every few minutes.
  const hasSession = Boolean(session?.token);
  useEffect(() => {
    if (!hasSession) return undefined;
    let cancelled = false;

    async function refresh() {
      try {
        const { data } = await authApi.me();
        if (cancelled || !data?.user) return;
        setSession((current) => {
          if (!current?.token) return current;
          const next = { ...current, user: { ...current.user, ...data.user }, organization: data.organization ?? current.organization };
          writeSession(next);
          return next;
        });
      } catch {
        // A rejected session is handled by the session-expired event; anything else keeps what we have.
      }
    }

    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [hasSession]);

  const logIn = useCallback(
    async (credentials) => startSession((await authApi.logIn(credentials)).data),
    [startSession]
  );

  const logOut = useCallback(async () => {
    try {
      await authApi.logOut();
    } catch {
    }
    setSessionExpired(false);
    endSession();
  }, [endSession]);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    const role = user?.role ?? null;
    // null for the Admin (every site); otherwise the sites this user covers.
    const siteIds = role === ROLES.ADMIN ? null : (user?.siteIds ?? (user?.siteId ? [user.siteId] : []));
    return {
      user,
      organization: session?.organization ?? null,
      role,
      siteIds,
      isAdmin: role === ROLES.ADMIN,
      // Admins and multi-site users choose a site on forms and filters; everyone else always works at their one site.
      canPickSite: role === ROLES.ADMIN || (siteIds?.length ?? 0) > 1,
      can: (resource, action) => userCan(user, resource, action),
      isAuthenticated: Boolean(session?.token),
      sessionExpired,
      previousUserId,
      mustChangePassword: Boolean(session?.user?.mustChangePassword),
      logIn,
      logOut,
      updateSession,
    };
  }, [session, sessionExpired, previousUserId, logIn, logOut, updateSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}
