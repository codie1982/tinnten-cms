'use client';

import { useRef, useState } from 'react';
import {
  useGetMailMediaAssetsQuery,
  useUploadMailMediaAssetMutation,
} from '@/redux/services/mailCampaignApi';
import {
  Check,
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  Upload,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf';

const kindIcon = {
  image: ImageIcon,
  video: Video,
  document: FileText,
};

const humanSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export function MailMediaLibrary({ open, onOpenChange, onInsert }) {
  const fileRef = useRef(null);
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const { data: assets = [], isLoading } = useGetMailMediaAssetsQuery(
    { limit: 100 },
    { skip: !open },
  );
  const [uploadAsset, { isLoading: uploading }] =
    useUploadMailMediaAssetMutation();

  const upload = async () => {
    if (!selectedFile) return;
    setNotice('');
    const result = await uploadAsset({ file: selectedFile, name: name.trim() })
      .unwrap()
      .catch((error) => ({
        __error:
          error?.normalizedMessage ||
          error?.data?.message ||
          'Yükleme başarısız.',
      }));
    if (result?.__error) {
      setNotice(result.__error);
      return;
    }
    setSelectedFile(null);
    setName('');
    if (fileRef.current) fileRef.current.value = '';
    setNotice(
      'Dosya S3’e yüklendi. Aşağıdaki listeden maile ekleyebilirsiniz.',
    );
  };

  const copyUrl = async (asset) => {
    await navigator.clipboard.writeText(asset.url);
    setCopiedId(String(asset._id));
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mail medya kütüphanesi</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
              <Input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
              />
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Görünen ad (opsiyonel)"
              />
              <Button
                type="button"
                onClick={upload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                S3’e yükle
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Görsel: en fazla 10 MB · Video: 50 MB · PDF: 20 MB
            </p>
            {notice && (
              <p className="mt-2 text-xs text-muted-foreground">{notice}</p>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Henüz medya dosyası yüklenmemiş.
            </p>
          ) : (
            <div className="grid max-h-[420px] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => {
                const Icon = kindIcon[asset.kind] || FileText;
                return (
                  <div
                    key={asset._id}
                    className="overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <div className="flex h-32 items-center justify-center bg-muted/40">
                      {asset.kind === 'image' ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Icon className="size-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <div>
                        <p
                          className="truncate text-sm font-medium"
                          title={asset.name}
                        >
                          {asset.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {humanSize(asset.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => onInsert(asset)}
                        >
                          Maile ekle
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          title="URL’yi kopyala"
                          onClick={() => copyUrl(asset)}
                        >
                          {copiedId === String(asset._id) ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MailMediaLibrary;
