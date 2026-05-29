'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setAuthToken } from '@/lib/authToken';
import { loginService, cmsLoginService } from '@/services/authService';
import {
  clearUserSession,
  loadUserSession,
  persistUserSession,
} from '@/lib/userSession';

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(1, 'Şifre zorunludur'),
});

// localStorage'daki session ile NextAuth oturumu aç; hata fırlat
async function resumeSessionFromStorage(session) {
  const { accessToken, refreshToken, userid, info, lang, company } = session;

  // CMS erişimini doğrula ve rolleri al
  const cmsPayload = await cmsLoginService(accessToken);
  const roles = cmsPayload?.data?.roles ?? [];

  const fullName =
    info?.name ||
    [info?.firstName, info?.lastName].filter(Boolean).join(' ').trim() ||
    info?.email ||
    '';

  const result = await signIn('ExternalCredentials', {
    redirect: false,
    email: info?.email ?? '',
    accessToken,
    refreshToken: refreshToken ?? '',
    userid: userid ?? '',
    name: fullName,
    company: company ?? '',
    lang: lang ?? '',
    roles: JSON.stringify(roles),
  });

  if (result?.error) throw new Error('Oturum yenilenemedi.');
}

export default function SignIn() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  // checking: localStorage kontrol edilirken form gizlenir
  const [checking, setChecking] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  // Sayfa yüklendiğinde mevcut localStorage oturumunu kontrol et
  useEffect(() => {
    const existing = loadUserSession();
    if (!existing?.accessToken) {
      setChecking(false);
      return;
    }

    resumeSessionFromStorage(existing)
      .then(() => {
        setAuthToken(existing.accessToken);
        router.replace('/cms/dashboard');
      })
      .catch((err) => {
        // 403 → cms:access yok; 401 → token süresi dolmuş
        clearUserSession();
        setChecking(false);
        if (err?.status === 403) {
          setServerError('Bu hesapta CMS erişim izni bulunmuyor.');
        }
        // 401 veya diğer durumlarda sadece formu göster
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async ({ email, password }) => {
    setServerError('');

    try {
      // 1. tinnten-server /auth/login
      const loginPayload = await loginService({ email, password });
      const loginData = loginPayload?.data;
      if (!loginData?.accessToken) throw new Error('Giriş yanıtı geçersiz.');

      // 2. CMS erişim iznini doğrula
      let roles = [];
      try {
        const cmsPayload = await cmsLoginService(loginData.accessToken);
        roles = cmsPayload?.data?.roles ?? [];
      } catch (err) {
        clearUserSession();
        throw Object.assign(
          new Error('CMS erişim izniniz bulunmuyor.'),
          { status: err?.status },
        );
      }

      // 3. localStorage'a kaydet (tinnten-nextjs ile uyumlu)
      persistUserSession(loginData);
      setAuthToken(loginData.accessToken);

      // 4. NextAuth session oluştur
      const profile = loginData.info || {};
      const fullName =
        profile.name ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

      const result = await signIn('ExternalCredentials', {
        redirect: false,
        email,
        accessToken: loginData.accessToken,
        refreshToken: loginData.refreshToken ?? '',
        userid: loginData.userid,
        name: fullName || email,
        company: loginData.company ?? '',
        lang: loginData.lang ?? '',
        roles: JSON.stringify(roles),
      });

      if (result?.error) throw new Error('Oturum oluşturulamadı.');

      router.push('/cms/dashboard');
    } catch (err) {
      setServerError(err.message || 'Giriş başarısız.');
    }
  };

  // localStorage kontrol edilirken tam ekran yükleme
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              tinnten CMS
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Yönetim panelinize giriş yapın
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                E-posta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@tinnten.ai"
                {...register('email')}
                className={cn(
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
                  'outline-none transition-shadow focus:ring-2 focus:ring-ring/30',
                  errors.email ? 'border-destructive' : 'border-input',
                )}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={cn(
                    'w-full rounded-lg border bg-background py-2 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground',
                    'outline-none transition-shadow focus:ring-2 focus:ring-ring/30',
                    errors.password ? 'border-destructive' : 'border-input',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5',
                'text-sm font-medium text-primary-foreground transition-colors',
                'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
