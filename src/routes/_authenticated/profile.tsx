import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · Ledgerly" }] }),
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const fn = useServerFn(getProfile);
  const upFn = useServerFn(updateProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fn() });
  const [name, setName] = useState("");
  useEffect(() => { if (data?.profile) setName(data.profile.name ?? ""); }, [data]);

  const save = useMutation({
    mutationFn: () => upFn({ data: { name: name || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile updated"); },
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">Personal account information.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle><CardDescription>Update your display name.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Email</Label><Input value={data.profile?.email ?? ""} disabled /></div>
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Roles</Label>
            <div className="flex gap-2 mt-1">
              {data.roles.length ? data.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>) : <Badge variant="outline">user</Badge>}
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
