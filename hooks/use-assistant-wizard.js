'use client';

/**
 * CMS asistan sihirbazı state'i — dashboard'daki `useAssistantWizard.ts` portu.
 *
 * Dashboard hook'undan FARKLARI:
 *  - Firma OPSİYONEL ve açıkça seçilir (dashboard aktif firmadan türetir).
 *  - Sözleşme (legal) ön kontrolü ve yayın kotası akışı YOK — CMS asistanı her
 *    zaman draft doğar, yayına alma firma tarafında yapılır.
 *  - Kullanıcı wizard'ının gizlediği hiçbir adım/tool koşullu değil; "library"
 *    adımı RAG kapalıyken bile açık (operatör önce kaynak bağlayıp sonra RAG'i
 *    açabilmeli).
 *
 * Payload sözleşmesi dashboard ile BİREBİR aynıdır — backend tek bir
 * `buildPayloadFromBody` ile ikisini de karşılar.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_APPROVAL_EVENT,
  DEFAULT_EMBED_CONFIG,
  DEFAULT_IMAGE_SCOPE,
  DEFAULT_OFFER_TOOL_SCOPE,
  DEFAULT_PRODUCT_DETAIL_SCOPE,
  DEFAULT_SCOPE,
  DEFAULT_SERVICE_DETAIL_SCOPE,
  isWebSearchEnabled,
  normalizeEmbedConfig,
  validatePrompt,
} from '@/lib/assistant-capabilities';
import {
  useCreateAssistantMutation,
  usePreviewAssistantIntentsMutation,
  useUpdateAssistantToolDefinitionMutation,
} from '@/redux/services';

export const WIZARD_STEPS = [
  { key: 'profile', label: 'Profil' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'appearance', label: 'Görünüm' },
  { key: 'capabilities', label: 'Yetenekler' },
  { key: 'library', label: 'Bilgi Tabanı' },
  { key: 'intents', label: 'Intent' },
  { key: 'publish', label: 'Yayın & Güvenlik' },
];

const initial = () => ({
  // Firma (CMS'e özel) — boş bırakılırsa asistan atanmamış doğar.
  companyId: '',
  profile: { title: '', description: '', tags: [] },
  prompt: { asistan_name: '', systemPrompt: '', locale: 'tr' },
  appearance: {
    welcomeTitle: '',
    welcomeSubtitle: '',
    inputPlaceholder: '',
    inputPosition: 'middle',
    inputStyle: 'simple',
    theme: {
      mode: 'auto',
      headerIconUrl: '',
      primaryColor: '#0a7cff',
      backgroundColor: '',
      textColor: '',
      fontFamily: '',
    },
    suggestionGroups: [],
  },
  capabilities: {
    enabledTools: ['DefaultTool'],
    disabledCapabilities: [],
    allowedFileTypes: ['pdf'],
    defaultWebSearchScope: { allowedTopics: [], allowedSites: [] },
    // Sihirbaz LLM üretimini KENDİ yapar (previewIntents → create → flush),
    // bu yüzden create payload'ında toolIntentAutogen.enabled her zaman false
    // gider. Bu bayrak yalnızca "üretimi çalıştır" tercihidir.
    aiIntents: true,
    toolDefOverrides: {},
  },
  library: { libraryIds: [], fileIds: [], websiteIds: [] },
  products: { ...DEFAULT_SCOPE },
  services: { ...DEFAULT_SCOPE },
  bookings: { ...DEFAULT_SCOPE },
  imageScope: { ...DEFAULT_IMAGE_SCOPE },
  offerToolScope: { ...DEFAULT_OFFER_TOOL_SCOPE },
  productDetailScope: { ...DEFAULT_PRODUCT_DETAIL_SCOPE },
  serviceDetailScope: { ...DEFAULT_SERVICE_DETAIL_SCOPE },
  bookingApprovalEvent: { ...DEFAULT_APPROVAL_EVENT },
  offerApprovalEvent: { ...DEFAULT_APPROVAL_EVENT },
  intentSettings: {
    enabled: false,
    mode: 'llm',
    minConfidence: 0.75,
    runAsync: true,
    maxMatchesPerMessage: 1,
  },
  intentDefinitions: [],
  publish: {
    allowGuest: true,
    guestMessageLimit: 3,
    embed: { ...DEFAULT_EMBED_CONFIG },
    safety: {
      outOfScopeBehavior: 'deny',
      allowWebFallback: false,
      allowGlobalProductSearch: false,
    },
    refusalPrompt: '',
  },
});

const cleanIds = (arr) =>
  (Array.isArray(arr) ? arr : []).map((s) => String(s).trim()).filter(Boolean);

const cleanScope = (s) => ({
  mode: s.mode,
  companyIds: cleanIds(s.companyIds),
  catalogIds: cleanIds(s.catalogIds),
  productIds: cleanIds(s.productIds),
  categoryIds: cleanIds(s.categoryIds),
  maxItems: s.maxItems,
  locationAware: s.locationAware === true,
  ...(typeof s.limit === 'number' ? { limit: s.limit } : {}),
});

export function useAssistantWizard() {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [step, setStep] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState(null); // null | 'generating' | 'creating' | 'saving'
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [createAssistant] = useCreateAssistantMutation();
  const [previewIntents] = usePreviewAssistantIntentsMutation();
  const [updateToolDef] = useUpdateAssistantToolDefinitionMutation();

  // Çift submit koruması: eş zamanlı (savingRef) + art arda (succeededRef).
  // Redirect birkaç saniye sürerken buton yeniden aktif olup ikinci asistan
  // oluşturmasın diye ikisi ayrı ayrı gerekli.
  const savingRef = useRef(false);
  const succeededRef = useRef(false);

  const set = useCallback((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const promptValidation = useMemo(() => validatePrompt(state.prompt), [state.prompt]);

  /** Detay tool'ları kendi kartında değil, ebeveynin detay toggle'ında yönetilir. */
  const enabledToolsPayload = useMemo(() => {
    const set_ = new Set(state.capabilities.enabledTools);
    set_.add('DefaultTool'); // backend zaten zorluyor; payload'ı da tutarlı tut
    if (state.productDetailScope.detailEnabled) set_.add('ProductDetailTool');
    else set_.delete('ProductDetailTool');
    if (state.serviceDetailScope.detailEnabled) set_.add('ServicesDetailTool');
    else set_.delete('ServicesDetailTool');
    return Array.from(set_);
  }, [
    state.capabilities.enabledTools,
    state.productDetailScope.detailEnabled,
    state.serviceDetailScope.detailEnabled,
  ]);

  const buildPayload = useCallback(() => {
    const s = state;
    const suggestionGroups = s.appearance.suggestionGroups
      .map((g) => ({
        ...g,
        label: (g.label || '').trim(),
        icon: (g.icon || '').trim(),
        prompts: (g.prompts || [])
          .map((p) => ({ ...p, text: (p.text || '').trim() }))
          .filter((p) => p.text.length > 0),
      }))
      .filter((g) => g.label.length > 0);

    const productScope = cleanScope(s.products);
    const serviceScope = cleanScope(s.services);
    const bookingScope = cleanScope(s.bookings);

    return {
      ...(s.companyId ? { companyId: s.companyId } : {}),
      // Prompt — kimlik + davranış (conversation'a enjekte edilir)
      asistan_name: s.prompt.asistan_name.trim(),
      locale: s.prompt.locale,
      systemPrompt: s.prompt.systemPrompt.trim(),
      // Profil — liste/SEO metadata (conversation'a GİTMEZ)
      title: s.profile.title.trim() || undefined,
      description: s.profile.description.trim() || undefined,
      tags: cleanIds(s.profile.tags),
      // Görünüm
      welcomeTitle: s.appearance.welcomeTitle.trim() || undefined,
      welcomeSubtitle: s.appearance.welcomeSubtitle.trim() || undefined,
      inputPlaceholder: s.appearance.inputPlaceholder.trim() || undefined,
      inputPosition: s.appearance.inputPosition,
      inputStyle: s.appearance.inputStyle,
      theme: s.appearance.theme,
      suggestionGroups: suggestionGroups.length ? suggestionGroups : undefined,
      // Yetenekler
      enabledTools: enabledToolsPayload,
      // Üretimi sihirbaz yaptı → backend create-sonrası TEKRAR üretmesin.
      toolIntentAutogen: { enabled: false },
      allowWebSearch: isWebSearchEnabled(s.capabilities.disabledCapabilities),
      disabledCapabilities: s.capabilities.disabledCapabilities,
      allowedFileTypes: s.capabilities.allowedFileTypes,
      // Bilgi Tabanı
      libraryIds: cleanIds(s.library.libraryIds),
      fileIds: cleanIds(s.library.fileIds),
      websiteIds: cleanIds(s.library.websiteIds),
      // Kapsamlar
      productScope,
      serviceScope,
      bookingScope,
      imageScope: s.imageScope,
      // Intent → Workflow binding (backend normalize + binding doğrulaması yapar)
      intentSettings: s.intentSettings,
      intentDefinitions: s.intentDefinitions.filter((i) => i.description && i.workflowRefId),
      // Yayın & Güvenlik
      conversationStrategy: {
        audience: s.publish.allowGuest ? 'all' : 'registered',
        guestMessageLimit: s.publish.guestMessageLimit,
      },
      slugMode: 'branded',
      runtimePolicy: {
        tools: { allow: enabledToolsPayload, deny: [], defaults: {} },
        capabilities: {
          allow: [],
          deny: [],
          overrides: {
            offer_request: {
              toolScope: s.offerToolScope,
              approvalEvent: s.offerApprovalEvent,
            },
            booking_search: { approvalEvent: s.bookingApprovalEvent },
            'ProductDetailTool:web_search': {
              enabled: s.productDetailScope.webSearchEnabled,
              allowedTopics: s.productDetailScope.allowedTopics,
            },
            'ProductDetailTool:url_scrape': { enabled: s.productDetailScope.scrapeEnabled },
            'ProductSearchTool:clarify': {
              enabled: s.productDetailScope.clarifyEnabled,
              threshold: s.productDetailScope.clarifyThreshold,
            },
            service_lead_submit: { enabled: s.serviceDetailScope.leadSubmitEnabled },
            'DefaultTool:web_search': {
              allowedTopics: s.capabilities.defaultWebSearchScope?.allowedTopics ?? [],
              allowedSites: s.capabilities.defaultWebSearchScope?.allowedSites ?? [],
            },
          },
        },
        prompts: {
          system: s.prompt.systemPrompt.trim(),
          planner: '',
          response: '',
          refusal: s.publish.refusalPrompt.trim(),
        },
        ui: {
          mode: 'chat',
          panels: {},
          responseView: {},
          input: {},
          embed: normalizeEmbedConfig(s.publish.embed),
        },
        feedback: { verbosity: 'compact', labels: {}, hiddenTypes: [] },
        // `allowGlobalProductSearch` TEK kaynaktan (ürün kapsamı) beslenir —
        // Güvenlik bölümünde ayrı bir kontrol yok ki iki kaynak çakışmasın.
        safety: {
          ...s.publish.safety,
          allowGlobalProductSearch: s.products.allowGlobalProductSearch === true,
        },
      },
    };
  }, [state, enabledToolsPayload]);

  const submit = useCallback(async () => {
    if (savingRef.current || succeededRef.current) return;
    if (!promptValidation.valid) {
      setStep('prompt');
      setSubmitError(promptValidation.errors[0] || 'Prompt adımını tamamlayın.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);

    try {
      // 1) LLM intent üretimi — asistan OLUŞMADAN önce, stateless.
      //    Başarısız olursa akış BLOKLANMAZ; asistan AI metinleri olmadan oluşur.
      const aiOverrides = {};
      if (state.capabilities.aiIntents) {
        setPhase('generating');
        try {
          const preview = await previewIntents({
            ...(state.companyId ? { companyId: state.companyId } : {}),
            enabledTools: enabledToolsPayload,
            productScope: cleanScope(state.products),
            serviceScope: cleanScope(state.services),
            asistan_name: state.prompt.asistan_name.trim() || undefined,
            title: state.profile.title.trim() || undefined,
            description: state.profile.description.trim() || undefined,
            systemPrompt: state.prompt.systemPrompt.trim() || undefined,
            locale: state.prompt.locale,
          }).unwrap();
          for (const def of preview?.toolDefinitions ?? []) {
            aiOverrides[def.toolName] = {
              description: def.description,
              examples: def.examples,
              keywords: def.keywords,
              rules: def.rules,
              userLabel: def.userLabel,
            };
          }
        } catch (e) {
          console.warn('[cms-wizard] intent önizleme başarısız:', e);
        }
      }

      // 2) Asistanı oluştur
      setPhase('creating');
      const res = await createAssistant(buildPayload()).unwrap();
      const assistantId = res?.assistant?.id;
      if (!assistantId) {
        setSubmitError('Asistan oluşturuldu ama ID alınamadı. Listeden açın.');
        return;
      }

      // 3) Tool tanımı override'larını yaz. Kullanıcının ELLE düzenlediği alanlar
      //    AI çıktısını EZER (spread sırası: önce AI, sonra manuel).
      const overrides = { ...aiOverrides, ...(state.capabilities.toolDefOverrides ?? {}) };
      const entries = Object.entries(overrides);
      if (entries.length) {
        setPhase('saving');
        await Promise.allSettled(
          entries.map(([toolKey, patch]) => updateToolDef({ id: assistantId, toolKey, ...patch })),
        );
      }

      succeededRef.current = true;
      setSubmitted(true);
      router.push(`/cms/assistants/${assistantId}`);
    } catch (err) {
      setPhase(null);
      setSubmitError(
        err?.data?.message || err?.normalizedMessage || 'Asistan oluşturulamadı.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    promptValidation,
    state,
    enabledToolsPayload,
    buildPayload,
    previewIntents,
    createAssistant,
    updateToolDef,
    router,
  ]);

  return {
    ...state,
    set,
    step,
    setStep,
    steps: WIZARD_STEPS,
    promptValidation,
    enabledToolsPayload,
    saving,
    phase,
    submitted,
    submitError,
    setSubmitError,
    submit,
  };
}
