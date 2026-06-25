'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    extensions: [StarterKit],
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
