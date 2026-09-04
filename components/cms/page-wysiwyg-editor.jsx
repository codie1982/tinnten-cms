'use client';

import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Heading2, ImagePlus, Italic,
  Link2, List, ListOrdered, Loader2, Minus, Quote, Redo, Table2, Undo, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { uploadDocMedia } from '@/lib/doc-media-upload';
import { useGetFilesQuery, useGetPublicTutorialVideosQuery } from '@/redux/services';

const DocImage = Node.create({
  name: 'docImage', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({
    src: { default: '', parseHTML: (element) => (element.matches('figure') ? element.querySelector('img')?.getAttribute('src') : element.getAttribute('src')) || '' },
    alt: { default: '', parseHTML: (element) => (element.matches('figure') ? element.querySelector('img')?.getAttribute('alt') : element.getAttribute('alt')) || '' },
    caption: { default: '', parseHTML: (element) => element.matches('figure') ? element.querySelector('figcaption')?.textContent || '' : '' },
    alignment: { default: 'center', parseHTML: (element) => element.getAttribute('data-align') || 'center', renderHTML: () => ({}) },
    decorative: { default: false, parseHTML: (element) => (element.matches('figure') ? element.querySelector('img') : element)?.getAttribute('data-decorative') === 'true', renderHTML: () => ({}) },
    assetId: { default: '', parseHTML: (element) => (element.matches('figure') ? element.querySelector('img') : element)?.getAttribute('data-asset-id') || '', renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'figure[data-doc-node="image"]' }, { tag: 'img' }],
  renderHTML: ({ HTMLAttributes }) => {
    const alignment = ['left', 'center', 'right'].includes(HTMLAttributes.alignment) ? HTMLAttributes.alignment : 'center';
    const figureClass = alignment === 'left' ? 'my-6 mr-auto max-w-full' : alignment === 'right' ? 'my-6 ml-auto max-w-full' : 'my-6 mx-auto max-w-full';
    return ['figure', { 'data-doc-node': 'image', 'data-align': alignment, class: figureClass },
      ['img', {
        src: HTMLAttributes.src, alt: HTMLAttributes.decorative ? '' : HTMLAttributes.alt,
        'data-decorative': HTMLAttributes.decorative ? 'true' : undefined,
        'data-asset-id': HTMLAttributes.assetId || undefined,
        loading: 'lazy', class: 'max-w-full rounded-xl',
      }],
      ...(HTMLAttributes.caption ? [['figcaption', { class: 'mt-2 text-sm text-muted-foreground' }, HTMLAttributes.caption]] : []),
    ];
  },
});

const DocVideo = Node.create({
  name: 'docVideo', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({
    src: { default: '' }, poster: { default: '' }, title: { default: '' },
    assetId: { default: '', parseHTML: (element) => element.getAttribute('data-asset-id'), renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'video[data-doc-node="video"]' }],
  renderHTML: ({ HTMLAttributes }) => ['video', mergeAttributes(HTMLAttributes, {
    'data-doc-node': 'video', controls: 'controls', preload: 'metadata', class: 'my-4 w-full rounded-xl',
    'data-asset-id': HTMLAttributes.assetId || undefined,
  })],
});

const VideoEmbed = Node.create({
  name: 'videoEmbed', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({
    provider: { default: '', parseHTML: (element) => element.getAttribute('data-provider'), renderHTML: () => ({}) },
    videoId: { default: '', parseHTML: (element) => element.getAttribute('data-video-id'), renderHTML: () => ({}) },
    title: { default: 'Video', parseHTML: (element) => element.getAttribute('data-title'), renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'div[data-doc-node="embed"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, {
    'data-doc-node': 'embed', 'data-provider': HTMLAttributes.provider,
    'data-video-id': HTMLAttributes.videoId, 'data-title': HTMLAttributes.title,
    class: 'my-4 rounded-xl border border-border bg-muted/30 p-6 text-center font-medium',
  }), `Video: ${HTMLAttributes.title || HTMLAttributes.videoId}`],
});

const TutorialEmbed = Node.create({
  name: 'tutorialEmbed', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({
    tutorialId: { default: '', parseHTML: (element) => element.getAttribute('data-tutorial-id'), renderHTML: () => ({}) },
    title: { default: 'Eğitim videosu', parseHTML: (element) => element.getAttribute('data-title'), renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'div[data-doc-node="tutorial"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, {
    'data-doc-node': 'tutorial', 'data-tutorial-id': HTMLAttributes.tutorialId,
    'data-title': HTMLAttributes.title,
    class: 'my-4 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center font-medium',
  }), `Eğitim: ${HTMLAttributes.title}`],
});

const parseVideoUrl = (raw) => {
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) return { provider: 'youtube', videoId: url.pathname.slice(1) };
    if (url.hostname.includes('youtube.com')) return { provider: 'youtube', videoId: url.searchParams.get('v') || url.pathname.split('/').pop() };
    if (url.hostname.includes('vimeo.com')) return { provider: 'vimeo', videoId: url.pathname.split('/').filter(Boolean).pop() };
  } catch {}
  return null;
};

function ToolButton({ title, active, onClick, children }) {
  return <button type="button" title={title} onClick={onClick} className={cn('flex size-8 items-center justify-center rounded-md hover:bg-accent', active && 'bg-primary/10 text-primary')}>{children}</button>;
}

function MediaDialog({ open, onOpenChange, editor, locale }) {
  const inputRef = useRef(null);
  const [tab, setTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [alignment, setAlignment] = useState('center');
  const [decorative, setDecorative] = useState(false);
  const [title, setTitle] = useState('');
  const [libraryType, setLibraryType] = useState('image');
  const { data: tutorials = [], isFetching: tutorialsLoading } = useGetPublicTutorialVideosQuery({ locale }, { skip: !open || tab !== 'tutorial' });
  const { data: filesData, isFetching: filesLoading } = useGetFilesQuery({ mediaType: libraryType, limit: 24, skip: 0 }, { skip: !open || tab !== 'library' });
  const files = filesData?.items ?? [];

  const close = () => { setError(''); setUrl(''); setAlt(''); setCaption(''); setAlignment('center'); setDecorative(false); setTitle(''); setLibraryType('image'); onOpenChange(false); };
  const addImage = (src, name = '', assetId = '') => {
    if (!decorative && !(alt || name).trim()) { setError('Dekoratif olmayan görseller için alt metin zorunludur.'); return; }
    editor.chain().focus().insertContent({ type: 'docImage', attrs: { src, alt: decorative ? '' : alt || name, caption, alignment, decorative, assetId } }).run();
    close();
  };
  const addVideo = (src, assetId = '') => { editor.chain().focus().insertContent({ type: 'docVideo', attrs: { src, assetId, title: title || 'Video' } }).run(); close(); };

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setError('');
    try {
      const asset = await uploadDocMedia(file);
      if (file.type.startsWith('image/')) addImage(asset.url, file.name, asset.id);
      else addVideo(asset.url, asset.id);
    } catch (uploadError) { setError(uploadError?.message || 'Medya yüklenemedi.'); }
    finally { setUploading(false); }
  }

  function addUrl() {
    const embed = parseVideoUrl(url.trim());
    if (embed) {
      editor.chain().focus().insertContent({ type: 'videoEmbed', attrs: { ...embed, title: title || 'Video' } }).run();
      close(); return;
    }
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) addVideo(url.trim());
    else addImage(url.trim(), alt);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>Medya Ekle</DialogTitle></DialogHeader>
      <DialogBody className="space-y-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {[['upload', 'Yükle'], ['library', 'Medya Kütüphanesi'], ['url', 'URL / Video'], ['tutorial', 'Eğitim Videoları']].map(([key, label]) =>
            <button key={key} type="button" onClick={() => setTab(key)} className={cn('rounded-md px-3 py-1.5 text-sm', tab === key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{label}</button>)}
        </div>
        {tab === 'upload' && <div className="space-y-3">
          <ImageFields alt={alt} setAlt={setAlt} caption={caption} setCaption={setCaption} alignment={alignment} setAlignment={setAlignment} decorative={decorative} setDecorative={setDecorative} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video başlığı" />
          <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={upload} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex min-h-36 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}{uploading ? 'Yükleniyor…' : 'Resim veya video seçin'}
          </button>
        </div>}
        {tab === 'url' && <div className="space-y-3"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Görsel, MP4, YouTube veya Vimeo URL’i" /><ImageFields alt={alt} setAlt={setAlt} caption={caption} setCaption={setCaption} alignment={alignment} setAlignment={setAlignment} decorative={decorative} setDecorative={setDecorative} /><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video başlığı" /><Button onClick={addUrl} disabled={!/^https:\/\//i.test(url)}>Ekle</Button></div>}
        {tab === 'library' && <div className="space-y-3"><div className="flex gap-2"><Button type="button" size="sm" variant={libraryType === 'image' ? 'default' : 'outline'} onClick={() => setLibraryType('image')}>Görseller</Button><Button type="button" size="sm" variant={libraryType === 'video' ? 'default' : 'outline'} onClick={() => setLibraryType('video')}>Videolar</Button></div>{libraryType === 'image' && <ImageFields alt={alt} setAlt={setAlt} caption={caption} setCaption={setCaption} alignment={alignment} setAlignment={setAlignment} decorative={decorative} setDecorative={setDecorative} />}<div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">{filesLoading ? <Loader2 className="size-5 animate-spin" /> : files.map((file) => { const src = file.path || file.previewUrl || file.url; const name = file.originalName || file.name; return src ? <button key={file._id || file.id} type="button" onClick={() => libraryType === 'video' ? addVideo(src, file._id || file.id) : addImage(src, name, file._id || file.id)} className="overflow-hidden rounded-lg border border-border text-left">{libraryType === 'video' ? <span className="grid aspect-video place-items-center bg-muted"><Video className="size-7 text-primary" /></span> : <img src={src} alt="" className="aspect-video w-full object-cover" />}<span className="block truncate p-2 text-xs">{name}</span></button> : null; })}</div></div>}
        {tab === 'tutorial' && <div className="max-h-80 space-y-2 overflow-y-auto">{tutorialsLoading ? <Loader2 className="size-5 animate-spin" /> : tutorials.map((video) => <button key={video.id} type="button" onClick={() => { editor.chain().focus().insertContent({ type: 'tutorialEmbed', attrs: { tutorialId: video.id, title: video.title } }).run(); close(); }} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:border-primary/40"><Video className="size-5 text-primary" /><span><strong className="block text-sm">{video.title}</strong><span className="line-clamp-1 text-xs text-muted-foreground">{video.description}</span></span></button>)}</div>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogBody>
      <DialogFooter><Button variant="outline" onClick={close}>Kapat</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ImageFields({ alt, setAlt, caption, setCaption, alignment, setAlignment, decorative, setDecorative }) {
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2"><Input value={alt} onChange={(e) => setAlt(e.target.value)} disabled={decorative} placeholder="Görsel alt metni" /><Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Görsel açıklaması (caption)" /></div>
    <div className="flex flex-wrap items-center gap-3"><label className="text-xs text-muted-foreground">Hizalama</label><select value={alignment} onChange={(e) => setAlignment(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={decorative} onChange={(e) => setDecorative(e.target.checked)} />Dekoratif görsel</label></div>
  </div>;
}

export function PageWysiwygEditor({ value, onChange, locale = 'tr' }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4, 5, 6] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }), TableKit, DocImage, DocVideo, VideoEmbed, TutorialEmbed,
    ],
    content: value || '', immediatelyRender: false,
    editorProps: { attributes: { class: 'min-h-[520px] max-w-none p-6 text-sm leading-7 outline-none [&_h2]:mt-7 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-s-4 [&_blockquote]:border-primary/30 [&_blockquote]:ps-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2' } },
    onUpdate: ({ editor: instance }) => onChange?.(instance.getHTML()),
  });

  useEffect(() => { if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '', false); }, [editor, value]);
  if (!editor) return <div className="min-h-[520px] animate-pulse rounded-xl bg-muted/30" />;
  const link = () => { const href = window.prompt('Bağlantı URL’i', editor.getAttributes('link')?.href || 'https://'); if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); };

  return <div className="overflow-hidden rounded-xl border border-input bg-background">
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-background/95 p-2 backdrop-blur">
      <ToolButton title="Kalın" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolButton>
      <ToolButton title="İtalik" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolButton>
      <ToolButton title="Başlık" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" /></ToolButton>
      <select aria-label="Başlık seviyesi" value={editor.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph'} onChange={(event) => { const level = Number(event.target.value); if (level >= 2 && level <= 6) editor.chain().focus().setHeading({ level }).run(); else editor.chain().focus().setParagraph().run(); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
        <option value="paragraph">Paragraf</option>{[2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>H{level}</option>)}
      </select>
      <ToolButton title="Liste" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolButton>
      <ToolButton title="Numaralı liste" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolButton>
      <ToolButton title="Alıntı" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></ToolButton>
      <ToolButton title="Kod" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="size-4" /></ToolButton>
      <ToolButton title="Bağlantı" active={editor.isActive('link')} onClick={link}><Link2 className="size-4" /></ToolButton>
      <ToolButton title="Sola hizala" onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="size-4" /></ToolButton>
      <ToolButton title="Ortala" onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="size-4" /></ToolButton>
      <ToolButton title="Sağa hizala" onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="size-4" /></ToolButton>
      <ToolButton title="Tablo" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="size-4" /></ToolButton>
      <ToolButton title="Yatay çizgi" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="size-4" /></ToolButton>
      <ToolButton title="Medya" onClick={() => setMediaOpen(true)}><ImagePlus className="size-4" /></ToolButton>
      <ToolButton title="Geri al" onClick={() => editor.chain().focus().undo().run()}><Undo className="size-4" /></ToolButton>
      <ToolButton title="İleri al" onClick={() => editor.chain().focus().redo().run()}><Redo className="size-4" /></ToolButton>
    </div>
    <EditorContent editor={editor} />
    <MediaDialog open={mediaOpen} onOpenChange={setMediaOpen} editor={editor} locale={locale} />
  </div>;
}
