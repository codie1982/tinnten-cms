const USER_INFO_KEY = 'user_info';

export const persistUserSession = (data) => {
  if (typeof window === 'undefined' || !data) return;
  try {
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(data));
  } catch {
    // localStorage erişilemez (private mode, kotası dolu vb.)
  }
};

export const loadUserSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_INFO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearUserSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(USER_INFO_KEY);
  } catch {
    // ignore
  }
};
