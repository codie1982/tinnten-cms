import CredentialsProvider from 'next-auth/providers/credentials';

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api/v10';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

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
          email === 'admin@tinnten.ai' &&
          password === 'cms2025'
        ) {
          return {
            id: 'dev-admin',
            userid: 'dev-admin',
            email: 'admin@tinnten.ai',
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
      if (user?.accessToken) token.accessToken = user.accessToken;
      if (user?.refreshToken) token.refreshToken = user.refreshToken;
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if (user?.id) token.id = user.id;
      if (user?.userid) token.userid = user.userid;
      if (user?.company) token.company = user.company;
      if (user?.lang) token.lang = user.lang;
      if (user?.roles) token.roles = user.roles;
      return token;
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
      return session;
    },
  },
  pages: { signIn: '/login' },
};

export default authOptions;
