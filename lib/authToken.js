let authToken = null;

export const getAuthToken = () => authToken;
export const setAuthToken = (token) => { authToken = token ?? null; };
export const clearAuthToken = () => { authToken = null; };
