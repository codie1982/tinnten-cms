import CredentialsProvider from 'next-auth/providers/credentials';
import { normalizeApiBaseUrl } from '@/config/api';

// Server-side ya da public env'den gelen değeri normalize et — env'de
// `/api/v10` suffix'i unutulmuşsa otomatik ekle, çift slash'ı temizle.
const BACKEND_URL = normalizeApiBaseUrl(
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

// Access token süresi dolmadan bu kadar önce (ms) proaktif yenile — clock skew
// ve istek gecikmesine karşı tampon.
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;
const FALLBACK_ACCESS_TTL_MS = 5 * 60 * 1000; // exp okunamazsa varsayılan 5 dk

/** Access token JWT'sinin `exp` claim'ini (ms) döndürür; okunamazsa null. */
const decodeJwtExpMs = (jwt) => {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

/**
 * Backend /auth/refresh-token ile access token'ı yeniler. Refresh token, CMS'in
 * kendi şifreli NextAuth JWT'sinde durur (cross-domain cookie sorunu YOK); backend'e
 * body + X-Refresh-Token header ile iletilir. Backend rotation yaptığından yeni
 * refresh token'ı da saklarız. Başarısızlıkta token'a `error` işaretlenir →
 * session.error → client signOut.
 */
const refreshAccessTokenViaBackend = async (token) => {
  try {
    if (!token?.refreshToken) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }
    const res = await fetch(`${BACKEND_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': token.refreshToken,
      },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });
    const payload = await res.json().catch(() => null);
    const data = payload?.data || payload || {};
    const newAccess = data.access_token;

    if (!res.ok || !newAccess) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    return {
      ...token,
      accessToken: newAccess,
      // Rotation: backend yeni refresh token döndürürse onu sakla, yoksa mevcut kalsın.
      refreshToken: data.refresh_token || token.refreshToken,
      accessTokenExpires:
        decodeJwtExpMs(newAccess) ||
        Date.now() + (Number(data.expires_in) > 0 ? Number(data.expires_in) * 1000 : FALLBACK_ACCESS_TTL_MS),
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
};

const normalizeBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }
  return defaultValue;
};

const authOptions = {
  secret: NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      id: 'ExternalCredentials',
      name: 'External Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'boolean' },
        accessToken: { label: 'Access Token', type: 'text' },
        refreshToken: { label: 'Refresh Token', type: 'text' },
        name: { label: 'Name', type: 'text' },
        userid: { label: 'User ID', type: 'text' },
        device: { label: 'Device', type: 'text' },
        deviceid: { label: 'Device ID', type: 'text' },
        company: { label: 'Company', type: 'text' },
        lang: { label: 'Language', type: 'text' },
        roles: { label: 'Roles', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim();
        const password = credentials?.password;
        const accessToken = credentials?.accessToken;

        // DEV bypass: DEV_MOCK_AUTH=true ile preview/geliştirme ortamında çalışır
        if (
          process.env.DEV_MOCK_AUTH === 'true' &&
          email === 'admin@tinten.ai' &&
          password === 'cms2025'
        ) {
          return {
            id: 'dev-admin',
            userid: 'dev-admin',
            email: 'admin@tinten.ai',
            name: 'Dev Admin',
            accessToken: 'dev-mock-token',
            refreshToken: null,
            company: null,
            lang: 'tr',
            roles: ['cms:admin', 'cms:editor', 'cms:access'],
          };
        }

        if (accessToken && !password) {
          // Login page zaten client-side validate ettiğinden burada tekrar
          // backend çağrısı yapmıyoruz; zorunlu alanları kontrol edip
          // session objesini döndürüyoruz.
          if (!credentials.userid && !email) {
            throw new Error(
              JSON.stringify({ code: 400, message: 'Missing user identity in token session.' }),
            );
          }

          let roles = [];
          try {
            roles = credentials.roles ? JSON.parse(credentials.roles) : [];
          } catch {
            roles = [];
          }

          const resolvedEmail = email || credentials.userid || credentials.name || '';

          return {
            id: credentials.userid || resolvedEmail,
            userid: credentials.userid || resolvedEmail,
            email: resolvedEmail,
            name: credentials.name || resolvedEmail,
            accessToken,
            refreshToken: credentials.refreshToken || null,
            company: credentials.company || null,
            lang: credentials.lang || null,
            roles,
          };
        }

        if (!email || !password) {
          throw new Error(
            JSON.stringify({
              code: 400,
              message: 'Please enter both email and password.',
            }),
          );
        }

        const rememberme = normalizeBoolean(credentials.rememberMe, true);
        const device = credentials.device || 'web';
        const deviceid = credentials.deviceid || credentials.deviceId;

        let loginResponse;
        try {
          loginResponse = await fetch(`${BACKEND_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
              rememberme,
              device,
              deviceid,
            }),
          });
        } catch {
          throw new Error(
            JSON.stringify({
              code: 503,
              message: 'Unable to reach authentication service.',
            }),
          );
        }

        let loginPayload = null;
        try {
          loginPayload = await loginResponse.json();
        } catch {
          throw new Error(
            JSON.stringify({
              code: loginResponse.status || 500,
              message: 'Unexpected response from authentication service.',
            }),
          );
        }

        if (!loginResponse.ok || loginPayload?.success === false) {
          throw new Error(
            JSON.stringify({
              code: loginPayload?.status?.code || loginResponse.status,
              message:
                loginPayload?.message ||
                'Login failed. Please check your credentials.',
            }),
          );
        }

        const loginData = loginPayload?.data;
        if (!loginData?.accessToken || !loginData?.userid) {
          throw new Error(
            JSON.stringify({
              code: 500,
              message:
                'Incomplete login response received from authentication service.',
            }),
          );
        }

        // cms:access izni kontrolü
        const cmsCheckRes = await fetch(`${BACKEND_URL}/auth/login/cms`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${loginData.accessToken}` },
        }).catch(() => null);

        if (!cmsCheckRes || !cmsCheckRes.ok) {
          throw new Error(
            JSON.stringify({
              code: 403,
              message: 'CMS erişim izniniz bulunmuyor.',
            }),
          );
        }

        const cmsPayload = await cmsCheckRes.json().catch(() => null);
        const roles = cmsPayload?.data?.roles ?? loginData.roles ?? [];

        const profile = loginData.info || {};
        const fullName =
          profile.name ||
          [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

        return {
          id: loginData.userid,
          userid: loginData.userid,
          email: profile.email || email,
          name: fullName || email,
          accessToken: loginData.accessToken,
          refreshToken: loginData.refreshToken,
          company: loginData.company,
          lang: loginData.lang,
          roles,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, credentials }) {
      if (credentials) {
        return !!user;
      }
      return false;
    },
    redirect({ url, baseUrl }) {
      // Relative path → her zaman baseUrl ile birleştir.
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Aynı origin → izin ver. Farklı origin → güvenli olarak baseUrl'e düş.
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* invalid URL → fall through */
      }
      return baseUrl;
    },
    async jwt({ token, user, session, trigger }) {
      if (trigger === 'update' && session?.user) {
        token = { ...token, ...session.user };
        return token;
      }

      // İlk giriş (authorize'dan user gelir): token alanlarını + expiry'yi yaz.
      if (user?.accessToken) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken || null;
        token.accessTokenExpires =
          decodeJwtExpMs(user.accessToken) || Date.now() + FALLBACK_ACCESS_TTL_MS;
        token.error = undefined;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
        if (user.id) token.id = user.id;
        if (user.userid) token.userid = user.userid;
        if (user.company) token.company = user.company;
        if (user.lang) token.lang = user.lang;
        if (user.roles) token.roles = user.roles;
        return token;
      }

      // Sonraki her session okumasında bu callback çalışır. refreshToken yoksa
      // (örn. DEV_MOCK_AUTH) yenileme yapma. Access token hâlâ geçerliyse dokunma.
      if (!token.refreshToken) return token;
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - ACCESS_TOKEN_REFRESH_BUFFER_MS
      ) {
        return token;
      }

      // Süresi doldu (veya expiry bilinmiyor) → backend'den yenile.
      return await refreshAccessTokenViaBackend(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || token.userid || session.user.id;
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
      }
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.refreshToken) session.refreshToken = token.refreshToken;
      if (token.company) session.company = token.company;
      if (token.lang) session.lang = token.lang;
      if (token.roles) session.roles = token.roles;
      // Yenileme kalıcı olarak başarısızsa client'a bildir → signOut (login'e yönlendir).
      if (token.error) session.error = token.error;
      return session;
    },
  },
  pages: { signIn: '/login' },
};

export default authOptions;
