import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Trash2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

type Props = {
  url: string | null;
  initials: string;
  busy?: boolean;
  onUpload: (blob: Blob) => Promise<void>;
  onRemove: () => Promise<void>;
};

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export function AvatarUploader({ url, initials, busy, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setSrc(reader.result as string); setZoom(1); setCrop({ x: 0, y: 0 }); };
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!src || !area) return;
    setSaving(true);
    try {
      const blob = await cropToBlob(src, area);
      await onUpload(blob);
      setSrc(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar className="h-24 w-24 border">
        {url ? <AvatarImage src={url} alt="Profile photo" className="object-cover" /> : null}
        <AvatarFallback className="bg-muted text-muted-foreground">
          {url ? initials : <User className="h-10 w-10" />}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera className="h-4 w-4 mr-1" /> {url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB. You can crop before saving.</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={pick} />
      </div>

      <Dialog open={!!src} onOpenChange={(o) => !o && setSrc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Crop your photo</DialogTitle></DialogHeader>
          <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
            {src && (
              <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
            )}
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider min={1} max={3} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSrc(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save photo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
