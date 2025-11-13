import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcrypt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/lib/prisma';

const USE_EXTERNAL_AUTH = process.env.EXTERNAL_AUTH === 'true';
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api/v10';

const normalizeBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }
  return defaultValue;
};

const externalAuthProviders = [
  CredentialsProvider({
    id: 'ExternalCredentials',
    name: 'External Credentials',
    credentials: {
      email: { label: 'Email', type: 'text' },
      password: { label: 'Password', type: 'password' },
      rememberMe: { label: 'Remember me', type: 'boolean' },
      accessToken: { label: 'Access Token', type: 'text' },
      name: { label: 'Name', type: 'text' },
      userid: { label: 'User ID', type: 'text' },
      device: { label: 'Device', type: 'text' },
      deviceid: { label: 'Device ID', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email) {
        throw new Error(
          JSON.stringify({
            code: 400,
            message: 'Please enter both email and password.',
          }),
        );
      }

      if (credentials?.accessToken && !credentials?.password) {
        const res = await fetch(`${BACKEND_URL}/auth/validate`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(
            JSON.stringify({
              code: res.status,
              message: 'Token validation failed',
            }),
          );
        }

        return {
          id: credentials.userid || credentials.email,
          userid: credentials.userid || credentials.email,
          email: credentials.email,
          name: credentials.name || 'User',
          accessToken: credentials.accessToken,
        };
      }

      if (!credentials?.password) {
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
            email: credentials.email,
            password: credentials.password,
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

      const profile = loginData.info || {};
      const fullName =
        profile.name ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

      return {
        id: loginData.userid,
        userid: loginData.userid,
        email: profile.email || credentials.email,
        name: fullName || credentials.email,
        accessToken: loginData.accessToken,
        refreshToken: loginData.refreshToken,
        company: loginData.company,
        lang: loginData.lang,
      };
    },
  }),
];

const prismaAuthProviders = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'text' },
      password: { label: 'Password', type: 'password' },
      rememberMe: { label: 'Remember me', type: 'boolean' },
    },
    async authorize(credentials) {
      if (!credentials || !credentials.email || !credentials.password) {
        throw new Error(
          JSON.stringify({
            code: 400,
            message: 'Please enter both email and password.',
          }),
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });
      if (!user) {
        throw new Error(
          JSON.stringify({
            code: 404,
            message: 'User not found. Please register first.',
          }),
        );
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password || '',
      );
      if (!isPasswordValid) {
        throw new Error(
          JSON.stringify({
            code: 401,
            message: 'Invalid credentials. Incorrect password.',
          }),
        );
      }

      if (user.status !== 'ACTIVE') {
        throw new Error(
          JSON.stringify({
            code: 403,
            message: 'Account not activated. Please verify your email.',
          }),
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastSignInAt: new Date() },
      });

      return {
        id: user.id,
        status: user.status,
        email: user.email,
        name: user.name || 'Anonymous',
        roleId: user.roleId,
        avatar: user.avatar,
      };
    },
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
    async profile(profile) {
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email },
        include: { role: { select: { id: true, name: true } } },
      });

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: profile.name,
            avatar: profile.picture || null,
            lastSignInAt: new Date(),
          },
        });
        return {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name || 'Anonymous',
          status: existingUser.status,
          roleId: existingUser.roleId,
          roleName: existingUser.role?.name,
          avatar: existingUser.avatar,
        };
      }

      const defaultRole = await prisma.userRole.findFirst({
        where: { isDefault: true },
      });
      if (!defaultRole)
        throw new Error('Default role not found. Unable to create a new user.');

      const newUser = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          password: '',
          avatar: profile.picture || null,
          emailVerifiedAt: new Date(),
          roleId: defaultRole.id,
          status: 'ACTIVE',
        },
      });

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name || 'Anonymous',
        status: newUser.status,
        avatar: newUser.avatar,
        roleId: newUser.roleId,
        roleName: defaultRole.name,
      };
    },
  }),
];

const authOptions = {
  adapter: USE_EXTERNAL_AUTH ? undefined : PrismaAdapter(prisma),
  providers: USE_EXTERNAL_AUTH ? externalAuthProviders : prismaAuthProviders,
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user, session, trigger }) {
      if (trigger === 'update' && session?.user) {
        token = { ...token, ...session.user };
        return token;
      }
      if (USE_EXTERNAL_AUTH) {
        if (user?.accessToken) token.accessToken = user.accessToken;
        if (user?.refreshToken) token.refreshToken = user.refreshToken;
        if (user?.email) token.email = user.email;
        if (user?.name) token.name = user.name;
        if (user?.id) token.id = user.id;
        if (user?.userid) token.userid = user.userid;
        if (user?.company) token.company = user.company;
        if (user?.lang) token.lang = user.lang;
        return token;
      }

      if (user && user.roleId) {
        const role = await prisma.userRole.findUnique({
          where: { id: user.roleId },
        });
        token.id = user.id || token.sub;
        token.email = user.email;
        token.name = user.name;
        token.avatar = user.avatar;
        token.status = user.status;
        token.roleId = user.roleId;
        token.roleName = role?.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || token.userid || session.user.id;
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
        session.user.avatar = token.avatar ?? session.user.avatar;
        session.user.status = token.status ?? session.user.status;
        session.user.roleId = token.roleId ?? session.user.roleId;
        session.user.roleName = token.roleName ?? session.user.roleName;
      }
      if (USE_EXTERNAL_AUTH) {
        if (token.accessToken) session.accessToken = token.accessToken;
        if (token.refreshToken) session.refreshToken = token.refreshToken;
        if (token.company) session.company = token.company;
        if (token.lang) session.lang = token.lang;
      }
      return session;
    },
  },
  pages: { signIn: '/signin' },
};

export default authOptions;
