import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { platformApi, PLATFORM_SESSION_EXPIRED_EVENT } from '../api/platformClient';
import { readPlatformSession, writePlatformSession, clearPlatformSession } from '../api/session';

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [session, setSession] = useState(readPlatformSession);
  const [sessionExpired, setSessionExpired] = useState(false);

  const startSession = useCallback(({ token, user }) => {
    const next = { token, user };
    writePlatformSession(next);
    setSession(next);
    setSessionExpired(false);
  }, []);

  const endSession = useCallback(() => {
    clearPlatformSession();
    setSession(null);
  }, []);

  useEffect(() => {
    function handleExpired() {
      setSessionExpired(true);
      endSession();
    }
    window.addEventListener(PLATFORM_SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(PLATFORM_SESSION_EXPIRED_EVENT, handleExpired);
  }, [endSession]);

  const logIn = useCallback(
    async (credentials) => startSession((await platformApi.logIn(credentials)).data),
    [startSession]
  );

  const logOut = useCallback(async () => {
    try {
      await platformApi.logOut();
    } catch {
    }
    setSessionExpired(false);
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.token),
      sessionExpired,
      logIn,
      logOut,
      startSession,
    }),
    [session, sessionExpired, logIn, logOut, startSession]
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (!context) throw new Error('usePlatformAuth must be used within <PlatformAuthProvider>');
  return context;
}
