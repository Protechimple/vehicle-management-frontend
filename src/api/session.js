const STORAGE_KEY = 'vmms.session';

export function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

export function readToken() {
  return readSession()?.token ?? null;
}

// The Super Admin session is kept under its own key, so it never mixes with an organization sign-in.
const PLATFORM_STORAGE_KEY = 'vmms.platformSession';

export function readPlatformSession() {
  try {
    const raw = localStorage.getItem(PLATFORM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePlatformSession(session) {
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(session));
  } catch {
  }
}

export function clearPlatformSession() {
  try {
    localStorage.removeItem(PLATFORM_STORAGE_KEY);
  } catch {
  }
}

export function readPlatformToken() {
  return readPlatformSession()?.token ?? null;
}
