import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getProfile, updateProfile, createAvatarUploadUrl, setAvatar, requestEmailChange,
} from "@/lib/invoices.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { BadgeCheck, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · InvoiceVision" }] }),
  component: Profile,
});

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA" }, { code: "+44", label: "UK" }, { code: "+91", label: "IN" },
  { code: "+61", label: "AU" }, { code: "+49", label: "DE" }, { code: "+33", label: "FR" },
  { code: "+971", label: "AE" }, { code: "+65", label: "SG" }, { code: "+81", label: "JP" },
  { code: "+55", label: "BR" }, { code: "+27", label: "ZA" }, { code: "+64", label: "NZ" },
];

const ROLES = [
  { value: "user", label: "User", help: "Upload and manage your own invoices only." },
  { value: "accountant", label: "Accountant", help: "Review, categorize and reconcile invoices for the team." },
  { value: "manager", label: "Manager", help: "Approve or reject invoices submitted by other users." },
  { value: "admin", label: "Admin", help: "Full access, including user management and settings." },
] as const;

const NAME_MIN = 2;
const NAME_MAX = 50;

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 15);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function Profile() {
  const qc = useQueryClient();
  const fn = useServerFn(getProfile);
  const upFn = useServerFn(updateProfile);
  const urlFn = useServerFn(createAvatarUploadUrl);
  const avatarFn = useServerFn(setAvatar);
  const emailFn = useServerFn(requestEmailChange);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fn() });

  const [name, setName] = useState("");
  const [cc, setCc] = useState("+1");
  const [phone, setPhone] = useState("");
  const [primary, setPrimary] = useState(true);
  const [role, setRole] = useState<string>("user");
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setName(p.name ?? "");
    setCc(p.phone_country_code ?? "+1");
    setPhone(p.phone_number ?? "");
    setPrimary(p.phone_is_primary ?? true);
    setRole(p.requested_role ?? data?.roles[0] ?? "user");
  }, [data]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length > 0 && trimmed.length < NAME_MIN ? `At least ${NAME_MIN} characters`
    : trimmed.length > NAME_MAX ? `Maximum ${NAME_MAX} characters` : null;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError = phoneDigits.length > 0 && phoneDigits.length < 4 ? "Enter a valid phone number" : null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["profile"] });

  const save = useMutation({
    mutationFn: () => upFn({ data: {
      name: trimmed || null,
      phone_country_code: phoneDigits ? cc : null,
      phone_number: phoneDigits ? phone : null,
      phone_is_primary: primary,
      requested_role: role as any,
    } }),
    onSuccess: () => { invalidate(); toast.success("Profile updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (blob: Blob) => {
      const { path, token } = await urlFn();
      const { error } = await supabase.storage.from("avatars").uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await avatarFn({ data: { path } });
    },
    onSuccess: () => { invalidate(); toast.success("Photo updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => avatarFn({ data: { path: null } }),
    onSuccess: () => { invalidate(); toast.success("Photo removed"); },
  });

  const changeEmail = useMutation({
    mutationFn: () => emailFn({ data: { email: newEmail } }),
    onSuccess: () => { setEmailOpen(false); setNewEmail(""); invalidate(); toast.success("Check your inbox to confirm the new address"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const initials = (trimmed || data.profile?.email || "?").split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  const grantedRoles = data.roles.length ? data.roles : ["user"];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">Manage how you appear and how we reach you.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Profile photo</CardTitle><CardDescription>Shown next to your name across InvoiceVision.</CardDescription></CardHeader>
        <CardContent>
          <AvatarUploader url={data.avatarUrl} initials={initials} busy={upload.isPending || remove.isPending}
            onUpload={async (b) => { await upload.mutateAsync(b); }} onRemove={async () => { await remove.mutateAsync(); }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal details</CardTitle><CardDescription>Your name and contact information.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Jane Doe" value={name} maxLength={NAME_MAX + 10}
              onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
            <div className="flex justify-between text-xs">
              <span className={nameError ? "text-destructive" : "text-muted-foreground"}>{nameError ?? `${NAME_MIN}–${NAME_MAX} characters`}</span>
              <span className={trimmed.length > NAME_MAX ? "text-destructive" : "text-muted-foreground"}>{trimmed.length}/{NAME_MAX}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input id="email" value={data.profile?.email ?? ""} readOnly className="pr-28" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {data.emailVerified ? (
                    <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setEmailOpen(true)}>Change email</Button>
            </div>
            {data.pendingEmail && (
              <p className="text-xs text-muted-foreground">Change to <span className="font-medium">{data.pendingEmail}</span> is awaiting confirmation.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <div className="flex gap-2">
              <Select value={cc} onValueChange={setCc}>
                <SelectTrigger className="w-32" aria-label="Country code"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} {c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input id="phone" type="tel" inputMode="tel" placeholder="555 123 4567" value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))} aria-invalid={!!phoneError} className="flex-1" />
            </div>
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            <label className="flex items-center gap-2 text-sm pt-1">
              <Checkbox checked={primary} onCheckedChange={(v) => setPrimary(v === true)} />
              Use as primary contact number
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
          <CardDescription>
            Currently granted: {grantedRoles.map((r) => <Badge key={r} variant="outline" className="ml-1 capitalize">{r}</Badge>)}.
            Selecting a different role sends a request to an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={role} onValueChange={setRole} className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label key={r.value} htmlFor={`role-${r.value}`}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/40">
                <RadioGroupItem id={`role-${r.value}`} value={r.value} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <p className="text-xs text-muted-foreground">{r.help}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !!nameError || !!phoneError}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change email address</DialogTitle>
            <DialogDescription>We'll send a confirmation link to the new address. Your current email stays active until you confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">New email</Label>
            <Input id="new-email" type="email" placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={() => changeEmail.mutate()} disabled={changeEmail.isPending || !/^\S+@\S+\.\S+$/.test(newEmail)}>Send confirmation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
