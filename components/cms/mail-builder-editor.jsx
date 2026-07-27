'use client';

import { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import presetNewsletter from 'grapesjs-preset-newsletter';
import 'grapesjs/dist/css/grapes.min.css';
import { API_HOST } from '@/config/api';
import { uploadProductImages } from '@/lib/product-image-upload';

const CMD_INLINE_HTML = 'gjs-get-inlined-html';

/** Yükleme sonucundaki göreli path'i mutlak URL'e çevirir (mailde şart). */
const resolveImageUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Builder çıktısını backend sözleşmesine uygun PARÇA'ya indirger.
 *
 * juice (inline CSS) girdiyi bazen tam belgeye sarar (<html><head>…<body>). Gövde
 * gönderimde wrapWithChrome ile FTL header/footer içine konduğu için burada
 * doctype/html/head/body kabuğu ATILIR — aksi halde iç içe iki belge oluşur.
 * Not: juice'un satır içine alamadığı media query'ler <style> olarak kalır;
 * bilerek korunuyor (responsive blokların tek dayanağı).
 */
const toFragment = (html) => {
  let out = String(html || '');
  const body = out.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) out = body[1];
  return out
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim();
};

/**
 * Kampanya şablonu için GrapesJS sürükle-bırak e-posta builder'ı.
 *
 * KRİTİK (backend sözleşmesi — Tiptap editörüyle AYNI):
 *  1) merge değişkenleri literal `{{TOKEN}}` metni olarak yazılır → backend
 *     regex'i (/{{(\w+)}}/g) düz token görür. Özel node/serialization YOK.
 *  2) Bağlantı/butonlar `data-track` trait'i taşır → backend injectTracking
 *     bunları imzalı tık URL'lerine çevirir.
 *  3) Çıktı tablo tabanlı + INLINE CSS'tir (preset-newsletter + juice) ve
 *     chrome'suz bir PARÇA'dır (bkz. toFragment).
 *
 * onChange her değişiklikte { html, design } döner: `html` gönderilen gövde,
 * `design` GrapesJS proje JSON'u (yeniden düzenleme yalnızca bundan yapılır;
 * HTML'den geri okuma kayıplıdır).
 *
 * Bu bileşen SADECE istemcide çalışır (grapesjs DOM'a bağlı) → sayfa tarafında
 * next/dynamic + ssr:false ile yüklenmeli.
 */
export function MailBuilderEditor({ value, design, onChange, variables = [] }) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const readyRef = useRef(false);
  // İlk içerik mount anında sabitlenir: sonraki prop değişimleri editörü
  // yeniden kurmamalı (kullanıcının canlı düzenlemesi sıfırlanırdı).
  const initialRef = useRef({ value, design });

  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState('');

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const editor = grapesjs.init({
      container: hostRef.current,
      fromElement: false,
      height: '70vh',
      width: 'auto',
      storageManager: false,
      undoManager: true,
      plugins: [presetNewsletter],
      pluginsOpts: {
        [presetNewsletter]: {
          inlineCss: true,
          modalTitleImport: 'HTML içe aktar',
          modalTitleExport: 'HTML çıktısı',
          modalBtnImport: 'İçe aktar',
          textCleanCanvas: 'Tüm tasarım silinecek. Emin misiniz?',
        },
      },
      assetManager: {
        // Mail görselleri MUTLAK URL olmak zorunda; yükleme CMS'in mevcut
        // görsel yükleyicisini kullanır (bkz. lib/product-image-upload.js).
        uploadFile: async (ev) => {
          const files = ev?.dataTransfer ? ev.dataTransfer.files : ev?.target?.files;
          if (!files?.length) return;
          setNotice('');
          try {
            const { uploaded } = await uploadProductImages(files);
            editor.AssetManager.add(uploaded.map((u) => resolveImageUrl(u.path)));
          } catch (err) {
            setNotice(err?.message || 'Görsel yüklenemedi.');
          }
        },
      },
    });

    editorRef.current = editor;

    // Tık takibi: seçilen bağlantı/butona `data-track` trait'i ekle.
    editor.on('component:selected', (component) => {
      if (!component || component.get('type') !== 'link') return;
      let existing = null;
      try {
        existing = component.getTrait('data-track');
      } catch {
        existing = null;
      }
      if (existing) return;
      component.addTrait({
        type: 'text',
        name: 'data-track',
        label: 'İzleme etiketi',
        placeholder: 'örn. blog-link',
      });
    });

    const initial = initialRef.current;
    const hasDesign =
      initial.design && typeof initial.design === 'object' && Object.keys(initial.design).length > 0;
    if (hasDesign) {
      try {
        editor.loadProjectData(initial.design);
      } catch {
        editor.setComponents(initial.value || '');
      }
    } else if (initial.value) {
      // Tiptap'ten gelen HTML → builder'a içe aktarılır (blok yapısı olmadığı
      // için tek parça metin olarak görünür; kullanıcı bloklarla zenginleştirir).
      editor.setComponents(initial.value);
    }

    let timer = null;
    const emit = () => {
      if (!readyRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        let html = '';
        try {
          html = String(editor.runCommand(CMD_INLINE_HTML) || '');
        } catch {
          html = editor.getHtml();
        }
        onChangeRef.current?.({ html: toFragment(html), design: editor.getProjectData() });
      }, 350);
    };

    // İlk içerik yüklemesinin tetiklediği update'ler "kullanıcı değişikliği"
    // değildir; emit yalnızca editör render'ı bittikten (load) sonra açılır.
    // `load` beklenmedik şekilde gelmezse 1sn'lik yedek zamanlayıcı devreye girer
    // (aksi halde kullanıcının hiçbir düzenlemesi forma yansımazdı).
    const markReady = () => {
      readyRef.current = true;
    };
    editor.on('load', markReady);
    const readyTimer = setTimeout(markReady, 1000);
    editor.on('update', emit);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(timer);
      readyRef.current = false;
      editorRef.current = null;
      editor.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * `{{TOKEN}}` ekler. Metin bloğu düzenleniyorsa imlecin olduğu yere, değilse
   * seçili metin bloğunun sonuna yazar; ikisi de yoksa kullanıcıyı yönlendirir.
   */
  const insertVar = (token) => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = `{{${token}}}`;
    setHint('');

    const editing = editor.getEditing?.();
    const rte = editor.RichTextEditor?.globalRte;
    if (editing && rte) {
      rte.insertHTML(text, { select: true });
      return;
    }

    const selected = editor.getSelected();
    if (selected && selected.get('type') === 'text') {
      const current = selected.getInnerHTML?.() ?? '';
      selected.components(`${current}${text}`);
      return;
    }

    setHint('Önce bir metin bloğuna çift tıklayıp imleci konumlandırın.');
  };

  return (
    <div className="space-y-2">
      {variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-background p-1.5">
          <span className="text-xs text-muted-foreground">Değişken ekle:</span>
          {variables.map((v) => (
            <button
              key={v.token}
              type="button"
              title={v.source || v.label || v.token}
              onClick={() => insertVar(v.token)}
              className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] hover:bg-accent"
            >
              {`{{${v.token}}}`}
            </button>
          ))}
        </div>
      )}

      {hint && <p className="text-[11px] text-amber-600">{hint}</p>}
      {notice && <p className="text-[11px] text-destructive">{notice}</p>}

      <div className="overflow-hidden rounded-lg border border-input">
        <div ref={hostRef} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Bağlantı/buton seçiliyken sağdaki <span className="font-medium">Settings</span> panelinden{' '}
        <span className="font-mono">data-track</span> etiketi girerek tık takibini açabilirsiniz.
      </p>
    </div>
  );
}

export default MailBuilderEditor;
