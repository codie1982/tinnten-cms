'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import { Bold, Italic, Link2, List, ListOrdered, Heading2, MousePointerClick, Undo, Redo } from 'lucide-react';
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
 * KRİTİK (backend sözleşmesi): merge değişkenleri editöre LİTERAL `{{TOKEN}}`
 * metni olarak eklenir → editor.getHTML() çıktısı backend regex'inin
 * (/{{(\w+)}}/g) gördüğü düz token'ı içerir. Custom node/serialization YOK,
 * bu yüzden extractVariables her zaman doğru çalışır.
 *
 * Next 15 app-router: 'use client' + immediatelyRender:false (SSR hydration).
 */
export function MailTemplateEditor({ value, onChange, variables = [] }) {
  const editor = useEditor({
    extensions: [StarterKit, TrackedLink],
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

  if (!editor) return null;

  const insertVar = (token) => editor.chain().focus().insertContent(`{{${token}}}`).run();

  const insertOrSetLink = () => {
    const currentHref = editor.getAttributes('link')?.href || '';
    const href = normalizeHref(globalThis.prompt?.('Bağlantı URL', currentHref) || '');
    if (!href) return;

    const rawTrack = globalThis.prompt?.('İzleme etiketi (opsiyonel)', '') || '';
    const dataTrack = sanitizeTrackingLabel(rawTrack);

    if (editor.state.selection.empty) {
      const text = globalThis.prompt?.('Bağlantı metni', href) || href;
      const trackAttr = dataTrack ? ` data-track="${escapeAttr(dataTrack)}"` : '';
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${escapeAttr(href)}"${trackAttr}>${escapeHtml(text)}</a>`)
        .run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href, dataTrack: dataTrack || null })
      .run();
  };

  const insertCtaButton = () => {
    const text = globalThis.prompt?.('Buton metni', 'Hemen Başla') || '';
    const href = normalizeHref(globalThis.prompt?.('Buton URL', 'https://tinten.ai/register') || '');
    if (!text.trim() || !href) return;

    const fallbackLabel = sanitizeTrackingLabel(text) || 'cta';
    const dataTrack =
      sanitizeTrackingLabel(globalThis.prompt?.('İzleme etiketi', fallbackLabel) || fallbackLabel) ||
      fallbackLabel;
    const style =
      'display:inline-block;padding:10px 18px;background:#1F2937;color:#fff;border-radius:6px;text-decoration:none;font-weight:600';

    editor
      .chain()
      .focus()
      .insertContent(
        `<a href="${escapeAttr(href)}" data-track="${escapeAttr(dataTrack)}" style="${escapeAttr(style)}">${escapeHtml(text)}</a>`
      )
      .run();
  };

  const Btn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 hover:bg-accent',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <Btn title="Kalın" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </Btn>
        <Btn title="İtalik" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </Btn>
        <Btn title="Başlık" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-4" />
        </Btn>
        <Btn title="Liste" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </Btn>
        <Btn title="Sıralı liste" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bağlantı ekle" active={editor.isActive('link')} onClick={insertOrSetLink}>
          <Link2 className="size-4" />
        </Btn>
        <Btn title="Buton ekle (CTA)" onClick={insertCtaButton}>
          <MousePointerClick className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Geri al" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="size-4" />
        </Btn>
        <Btn title="İleri al" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="size-4" />
        </Btn>

        {variables.length > 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
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
    </div>
  );
}

export default MailTemplateEditor;
