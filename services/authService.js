import http from '@/lib/http';

export const loginService = async ({
  email,
  password,
  rememberme = true,
  device = 'web',
  deviceid,
}) => {
  const res = await http.post('auth/login', {
    email,
    password,
    rememberme,
    device,
    deviceid,
  });
  return res.data;
};

export const cmsLoginService = async (accessToken) => {
  const res = await http.post(
    'auth/login/cms',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
};

export const validateTokenService = async (accessToken) => {
  const res = await http.get('auth/validate', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
};

export const refreshTokenService = async () => {
  const res = await http.post('auth/refresh-token', {});
  return res.data;
};

export const logoutService = async (accessToken) => {
  const res = await http.post(
    'auth/logout',
    {},
    accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  );
  return res.data;
};
