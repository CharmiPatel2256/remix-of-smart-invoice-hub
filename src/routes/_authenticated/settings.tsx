import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Ledgerly" }] }),
  component: Settings,
});

function Settings() {
  async function sendReset() {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace preferences.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Security</CardTitle><CardDescription>Reset your account password.</CardDescription></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={sendReset}>Send password reset email</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>About</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Ledgerly — Smart Invoice Processing.</p>
          <p>Powered by Lovable Cloud + AI Gateway (Gemini).</p>
        </CardContent>
      </Card>
    </div>
  );
}
