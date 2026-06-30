'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Baseline,
  Link2,
  List,
  ListOrdered,
  Heading2,
  MousePointerClick,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const sanitizeTrackingLabel = (value) =>
  String(value || '')
    .trim()
    .slice(0, 80)
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttr = (value) =>
  escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeHref = (value) => {
  const href = String(value || '').trim();
  if (!href) return '';
  if (/^(https?:\/\/|\/)/i.test(href)) return href;
  return `https://${href}`;
};

// E-posta güvenli renkler/boyutlar — hepsi inline style olarak serialize olur.
const TEXT_COLORS = [
  '#111827', '#374151', '#6B7280', '#9CA3AF',
  '#DC2626', '#EA580C', '#CA8A04', '#16A34A',
  '#2563EB', '#7C3AED', '#DB2777', '#0891B2',
];
const FONT_SIZES = [
  { label: 'Küçük', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Orta', value: '16px' },
  { label: 'Büyük', value: '18px' },
  { label: 'Çok büyük', value: '24px' },
];

// CTA buton stili — backend injectTracking <a data-track> bekler; stil inline kalır.
const buildCtaStyle = (bg) =>
  `display:inline-block;padding:10px 18px;background:${bg || '#1F2937'};color:#fff;border-radius:6px;text-decoration:none;font-weight:600`;

const TrackedLink = TiptapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataTrack: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-track'),
        renderHTML: (attributes) => {
          const value = sanitizeTrackingLabel(attributes.dataTrack);
          return value ? { 'data-track': value } : {};
        },
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
}).configure({
  openOnClick: false,
  HTMLAttributes: { rel: 'noopener' },
});

/**
 * Kampanya şablonu için Tiptap WYSIWYG editör.
 *
 * KRİTİK (backend sözleşmesi):
 *  1) merge değişkenleri editöre LİTERAL `{{TOKEN}}` metni olarak eklenir →
 *     editor.getHTML() çıktısı backend regex'inin (/{{(\w+)}}/g) gördüğü düz
 *     token'ı içerir. Custom node/serialization YOK.
 *  2) Bağlantı/CTA'lar `data-track` taşır → backend injectTracking bunları
 *     imzalı tık URL'lerine çevirir.
 *  3) Tüm biçimlendirme e-posta güvenli olmalı: renk/boyut/hizalama INLINE
 *     style olarak serialize olur (TextStyle/Color/FontSize/TextAlign),
 *     altı çizili/üstü çizili <u>/<s> etiketleridir. <style>/class KULLANILMAZ.
 *
 * Next 15 app-router: 'use client' + immediatelyRender:false (SSR hydration).
 */
export function MailTemplateEditor({ value, onChange, variables = [] }) {
  const editor = useEditor({
    extensions: [
      // StarterKit 3.x kendi `link`'ini de içerir → TrackedLink ile ad çakışmasın
      // diye kapatıyoruz; underline/strike mark'ları açık kalır.
      StarterKit.configure({ link: false }),
      TrackedLink,
      TextStyle, // renk & font-size için inline <span style> taşıyıcısı
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[320px] max-w-none p-3 text-sm leading-relaxed outline-none [&_h2]:text-lg [&_h2]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
  });

  // Dış value değişimini (yükleme sonrası) editöre yansıt; aynıysa dokunma.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== undefined && value !== current) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  const [colorOpen, setColorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ href: '', text: '', track: '', applyToExisting: false });
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaForm, setCtaForm] = useState({ text: 'Hemen Başla', href: 'https://tinten.ai/register', track: '', bg: '#1F2937' });

  if (!editor) return null;

  const insertVar = (token) => editor.chain().focus().insertContent(`{{${token}}}`).run();

  const applyColor = (color) => {
    editor.chain().focus().setColor(color).run();
    setColorOpen(false);
  };
  const clearColor = () => {
    editor.chain().focus().unsetColor().run();
    setColorOpen(false);
  };

  const setFontSize = (size) => {
    if (size) editor.chain().focus().setFontSize(size).run();
    else editor.chain().focus().unsetFontSize().run();
  };
  const currentFontSize = editor.getAttributes('textStyle')?.fontSize || '';

  const openLinkDialog = () => {
    const attrs = editor.getAttributes('link') || {};
    const editingExisting = !!attrs.href;
    const hasSelection = !editor.state.selection.empty;
    setLinkForm({
      href: attrs.href || '',
      text: '',
      track: attrs.dataTrack || '',
      applyToExisting: editingExisting || hasSelection,
    });
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = normalizeHref(linkForm.href);
    if (!href) return;
    const dataTrack = sanitizeTrackingLabel(linkForm.track);

    if (linkForm.applyToExisting) {
      editor.chain().focus().extendMarkRange('link').setLink({ href, dataTrack: dataTrack || null }).run();
    } else {
      const text = linkForm.text.trim() || href;
      const trackAttr = dataTrack ? ` data-track="${escapeAttr(dataTrack)}"` : '';
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${escapeAttr(href)}"${trackAttr}>${escapeHtml(text)}</a>`)
        .run();
    }
    setLinkOpen(false);
  };

  const openCtaDialog = () => {
    setCtaForm({ text: 'Hemen Başla', href: 'https://tinten.ai/register', track: '', bg: '#1F2937' });
    setCtaOpen(true);
  };

  const applyCta = () => {
    const text = ctaForm.text.trim();
    const href = normalizeHref(ctaForm.href);
    if (!text || !href) return;
    const fallbackLabel = sanitizeTrackingLabel(text) || 'cta';
    const dataTrack = sanitizeTrackingLabel(ctaForm.track) || fallbackLabel;
    const style = buildCtaStyle(ctaForm.bg);
    editor
      .chain()
      .focus()
      .insertContent(
        `<a href="${escapeAttr(href)}" data-track="${escapeAttr(dataTrack)}" style="${escapeAttr(style)}">${escapeHtml(text)}</a>`
      )
      .run();
    setCtaOpen(false);
  };

  const Btn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('rounded-md px-2 py-1 hover:bg-accent', active && 'bg-primary/10 text-primary')}
    >
      {children}
    </button>
  );

  const Divider = () => <span className="mx-1 h-5 w-px bg-border" />;

  return (
    <div className="rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <Btn title="Kalın" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </Btn>
        <Btn title="İtalik" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </Btn>
        <Btn title="Altı çizili" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-4" />
        </Btn>
        <Btn title="Üstü çizili" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </Btn>

        <Divider />

        {/* Metin rengi */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Metin rengi"
              className={cn('rounded-md px-2 py-1 hover:bg-accent', editor.isActive('textStyle') && 'bg-primary/10 text-primary')}
            >
              <Baseline className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3" onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="grid grid-cols-6 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => applyColor(c)}
                  className="size-6 rounded-md border border-border"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="color"
                  className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
                  onChange={(e) => applyColor(e.target.value)}
                />
                Özel
              </label>
              <button type="button" onClick={clearColor} className="text-xs text-muted-foreground hover:text-foreground">
                Rengi kaldır
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Yazı boyutu */}
        <select
          title="Yazı boyutu"
          value={currentFontSize}
          onChange={(e) => setFontSize(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">Boyut</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <Divider />

        <Btn title="Başlık" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-4" />
        </Btn>
        <Btn title="Liste" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </Btn>
        <Btn title="Sıralı liste" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </Btn>

        <Divider />

        <Btn title="Sola hizala" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="size-4" />
        </Btn>
        <Btn title="Ortala" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="size-4" />
        </Btn>
        <Btn title="Sağa hizala" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="size-4" />
        </Btn>

        <Divider />

        <Btn title="Bağlantı ekle" active={editor.isActive('link')} onClick={openLinkDialog}>
          <Link2 className="size-4" />
        </Btn>
        <Btn title="Buton ekle (CTA)" onClick={openCtaDialog}>
          <MousePointerClick className="size-4" />
        </Btn>

        <Divider />

        <Btn title="Geri al" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="size-4" />
        </Btn>
        <Btn title="İleri al" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="size-4" />
        </Btn>

        {variables.length > 0 && (
          <>
            <Divider />
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
          </>
        )}
      </div>
      <EditorContent editor={editor} />

      {/* Bağlantı dialogu */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bağlantı</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
            <DialogBody className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">URL</label>
                <Input
                  autoFocus
                  value={linkForm.href}
                  onChange={(e) => setLinkForm((f) => ({ ...f, href: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              {!linkForm.applyToExisting && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Bağlantı metni</label>
                  <Input
                    value={linkForm.text}
                    onChange={(e) => setLinkForm((f) => ({ ...f, text: e.target.value }))}
                    placeholder="Boşsa URL gösterilir"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">İzleme etiketi (opsiyonel)</label>
                <Input
                  value={linkForm.track}
                  onChange={(e) => setLinkForm((f) => ({ ...f, track: e.target.value }))}
                  placeholder="örn. blog-link"
                  className="font-mono text-xs"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit">Ekle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CTA buton dialogu */}
      <Dialog open={ctaOpen} onOpenChange={setCtaOpen}>
        <DialogContent className="max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Buton (CTA)</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); applyCta(); }}>
            <DialogBody className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Buton metni</label>
                <Input
                  autoFocus
                  value={ctaForm.text}
                  onChange={(e) => setCtaForm((f) => ({ ...f, text: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">URL</label>
                <Input
                  value={ctaForm.href}
                  onChange={(e) => setCtaForm((f) => ({ ...f, href: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">İzleme etiketi</label>
                  <Input
                    value={ctaForm.track}
                    onChange={(e) => setCtaForm((f) => ({ ...f, track: e.target.value }))}
                    placeholder="Boşsa metinden türetilir"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Arka plan</label>
                  <input
                    type="color"
                    value={ctaForm.bg}
                    onChange={(e) => setCtaForm((f) => ({ ...f, bg: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCtaOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit">Ekle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MailTemplateEditor;
