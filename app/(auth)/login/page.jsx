'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { getSession, signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setAuthToken } from '@/lib/authToken';
import {
  clearUserSession,
  loadUserSession,
  persistUserSession,
} from '@/lib/userSession';
import { cn } from '@/lib/utils';
import {
  cmsLoginService,
  loginService,
  resendLoginSmsMfaService,
  verifyLoginSmsMfaService,
} from '@/services/authService';

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(1, 'Şifre zorunludur'),
});

const DASHBOARD_PATH = '/cms/dashboard';
const RESUME_ATTEMPT_KEY = 'cms_resume_attempt_at';
const RESUME_LOOP_WINDOW_MS = 15_000;

const redirectToDashboard = () => {
  window.location.assign(DASHBOARD_PATH);
};

const assertSignInSucceeded = (result, message) => {
  const url = String(result?.url || '');
  if (
    !result?.ok ||
    result?.error ||
    url.includes('/api/auth/error') ||
    url.includes('/login')
  ) {
    throw new Error(message);
  }
};

// signIn POST'u Set-Cookie döner; cookie yanlış domain/secret nedeniyle
// browser'a yerleşmediyse middleware token'ı okuyamaz ve sonsuz redirect
// döngüsüne gireriz. /session endpoint'ini cookie ile çağırıp gerçekten
// session kurulup kurulmadığını doğruluyoruz.
async function assertSessionEstablished() {
  const session = await getSession();
  if (!session?.user) {
    const err = new Error(
      "Oturum çerezi tarayıcıya yerleşmedi. NEXTAUTH_URL ayarınızı erişim domain'i ile eşleştirin.",
    );
    err.code = 'COOKIE_NOT_SET';
    throw err;
  }
}

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
  const sessionEmail = info?.email || session?.email || userid || '';

  const result = await signIn('ExternalCredentials', {
    redirect: false,
    callbackUrl: DASHBOARD_PATH,
    email: sessionEmail,
    accessToken,
    refreshToken: refreshToken ?? '',
    userid: userid ?? '',
    name: fullName,
    company: company ?? '',
    lang: lang ?? '',
    roles: JSON.stringify(roles),
  });

  assertSignInSucceeded(result, 'Oturum yenilenemedi.');
  await assertSessionEstablished();
  redirectToDashboard();
}

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaNotice, setMfaNotice] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
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

    // Döngü koruması: yakın zamanda otomatik resume denedik ve yine
    // login sayfasındayız → cookie kurulmuyor demektir, kullanıcıya formu göster.
    let lastAttempt = 0;
    try {
      lastAttempt = Number(sessionStorage.getItem(RESUME_ATTEMPT_KEY) || 0);
    } catch {
      lastAttempt = 0;
    }
    if (lastAttempt && Date.now() - lastAttempt < RESUME_LOOP_WINDOW_MS) {
      clearUserSession();
      try {
        sessionStorage.removeItem(RESUME_ATTEMPT_KEY);
      } catch {
        /* ignore */
      }
      setChecking(false);
      setServerError(
        'Oturum kurulamadı (cookie yerleşmedi). Lütfen tekrar giriş yapın.',
      );
      return;
    }
    try {
      sessionStorage.setItem(RESUME_ATTEMPT_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }

    resumeSessionFromStorage(existing)
      .then(() => {
        setAuthToken(existing.accessToken);
      })
      .catch((err) => {
        // 403 → cms:access yok; 401 → token süresi dolmuş
        clearUserSession();
        try {
          sessionStorage.removeItem(RESUME_ATTEMPT_KEY);
        } catch {
          /* ignore */
        }
        setChecking(false);
        if (err?.code === 'COOKIE_NOT_SET') {
          setServerError(err.message);
        } else if (err?.status === 403) {
          setServerError('Bu hesapta CMS erişim izni bulunmuyor.');
        }
        // 401 veya diğer durumlarda sadece formu göster
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mfaChallenge?.retryAt) {
      setResendSeconds(0);
      return undefined;
    }

    const updateCountdown = () => {
      const retryAt = new Date(mfaChallenge.retryAt).getTime();
      setResendSeconds(
        Number.isFinite(retryAt)
          ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
          : 0,
      );
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [mfaChallenge?.retryAt]);

  const completeLogin = async (loginData, email) => {
    if (!loginData?.accessToken) throw new Error('Giriş yanıtı geçersiz.');

    // CMS erişim iznini yalnız MFA tamamlandıktan sonra doğrula.
    let roles = [];
    try {
      const cmsPayload = await cmsLoginService(loginData.accessToken);
      roles = cmsPayload?.data?.roles ?? [];
    } catch (err) {
      clearUserSession();
      throw Object.assign(new Error('CMS erişim izniniz bulunmuyor.'), {
        status: err?.status,
      });
    }

    persistUserSession(loginData);
    setAuthToken(loginData.accessToken);

    const profile = loginData.info || {};
    const fullName =
      profile.name ||
      [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

    const result = await signIn('ExternalCredentials', {
      redirect: false,
      callbackUrl: DASHBOARD_PATH,
      email,
      accessToken: loginData.accessToken,
      refreshToken: loginData.refreshToken ?? '',
      userid: loginData.userid,
      name: fullName || email,
      company: loginData.company ?? '',
      lang: loginData.lang ?? '',
      roles: JSON.stringify(roles),
    });

    assertSignInSucceeded(result, 'Oturum oluşturulamadı.');
    await assertSessionEstablished();

    try {
      sessionStorage.removeItem(RESUME_ATTEMPT_KEY);
    } catch {
      /* ignore */
    }

    redirectToDashboard();
  };

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    setMfaNotice('');

    try {
      // 1. tinnten-server /auth/login
      const loginPayload = await loginService({ email, password });
      const loginData = loginPayload?.data;
      if (loginData?.mfaRequired === true) {
        if (loginData.phoneEnrollmentRequired || !loginData.challengeId) {
          throw new Error(
            'CMS girişi için önce Tinten hesabınızda doğrulanmış bir telefon numarası ekleyin.',
          );
        }
        setMfaEmail(email);
        setMfaChallenge(loginData);
        setMfaCode('');
        setMfaNotice('Doğrulama kodu SMS ile gönderildi.');
        return;
      }

      await completeLogin(loginData, email);
    } catch (err) {
      // Cookie kurulamadıysa localStorage'ı temizle → bir sonraki yükleme
      // formu açar, otomatik resume tetiklenmez.
      if (err?.code === 'COOKIE_NOT_SET') {
        clearUserSession();
      }
      setServerError(err.message || 'Giriş başarısız.');
    }
  };

  const verifyMfaCode = async (event) => {
    event.preventDefault();
    if (mfaSubmitting || !mfaChallenge?.challengeId) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      setServerError('6 haneli doğrulama kodunu girin.');
      return;
    }

    setMfaSubmitting(true);
    setServerError('');
    setMfaNotice('');
    try {
      const verification = await verifyLoginSmsMfaService({
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
      });
      await completeLogin(verification?.data, mfaEmail);
    } catch (err) {
      setServerError(err.message || 'Doğrulama kodu geçersiz.');
    } finally {
      setMfaSubmitting(false);
    }
  };

  const resendMfaCode = async () => {
    if (mfaSubmitting || resendSeconds > 0 || !mfaChallenge?.challengeId) {
      return;
    }

    setMfaSubmitting(true);
    setServerError('');
    setMfaNotice('');
    try {
      const response = await resendLoginSmsMfaService({
        challengeId: mfaChallenge.challengeId,
        locale: 'tr',
      });
      setMfaChallenge((current) => ({
        ...current,
        ...(response?.data || {}),
      }));
      setMfaCode('');
      setMfaNotice('Yeni doğrulama kodu SMS ile gönderildi.');
    } catch (err) {
      setServerError(err.message || 'Doğrulama kodu yeniden gönderilemedi.');
    } finally {
      setMfaSubmitting(false);
    }
  };

  const backToPasswordLogin = () => {
    setMfaChallenge(null);
    setMfaCode('');
    setMfaEmail('');
    setMfaNotice('');
    setServerError('');
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
              {mfaChallenge
                ? 'İki adımlı doğrulama'
                : 'Yönetim panelinize giriş yapın'}
            </p>
          </div>

          {mfaChallenge ? (
            <form onSubmit={verifyMfaCode} className="space-y-5">
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {mfaChallenge.maskedPhone || 'Doğrulanmış telefonunuza'}
                  </span>{' '}
                  gönderilen 6 haneli kodu girin.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="mfa-code"
                  className="text-sm font-medium text-foreground"
                >
                  Doğrulama kodu
                </label>
                <input
                  id="mfa-code"
                  name="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCode}
                  onChange={(event) =>
                    setMfaCode(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  placeholder="000000"
                  minLength={6}
                  maxLength={6}
                  className={cn(
                    'w-full rounded-lg border bg-background px-3 py-2.5 text-center text-lg font-semibold tracking-[0.35em] text-foreground placeholder:text-muted-foreground',
                    'outline-none transition-shadow focus:ring-2 focus:ring-ring/30',
                    serverError ? 'border-destructive' : 'border-input',
                  )}
                />
              </div>

              {mfaNotice && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                  {mfaNotice}
                </p>
              )}

              {serverError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={mfaSubmitting || mfaCode.length !== 6}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5',
                  'text-sm font-medium text-primary-foreground transition-colors',
                  'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {mfaSubmitting && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                {mfaSubmitting ? 'Doğrulanıyor...' : 'Doğrula ve Giriş Yap'}
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={backToPasswordLogin}
                  disabled={mfaSubmitting}
                  className="font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  Giriş ekranına dön
                </button>
                <button
                  type="button"
                  onClick={resendMfaCode}
                  disabled={mfaSubmitting || resendSeconds > 0}
                  className="font-medium text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  {resendSeconds > 0
                    ? `Tekrar gönder (${resendSeconds} sn)`
                    : 'Kodu tekrar gönder'}
                </button>
              </div>
            </form>
          ) : (
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
                  placeholder="ornek@tinten.ai"
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
          )}
        </div>
      </div>
    </div>
  );
}
