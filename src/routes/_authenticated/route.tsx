import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile } from "@/lib/invoices.functions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, FileText, Upload, BarChart3, Bell, Settings, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function HeaderIdentity({ fallbackEmail }: { fallbackEmail: string }) {
  const fn = useServerFn(getProfile);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fn() });
  const name = data?.profile?.name?.trim() || fallbackEmail.split("@")[0] || "User";
  const role = (data?.roles[0] ?? "user").toLowerCase();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return (
    <Link to="/profile" className="flex items-center gap-3 rounded-md pl-2 pr-1 py-1 hover:bg-accent transition-colors">
      <div className="flex flex-col items-end leading-tight text-right">
        <span className="text-sm font-semibold text-foreground truncate max-w-[10rem]">{name}</span>
        <span className="text-xs text-muted-foreground lowercase">{role}</span>
      </div>
      <Avatar className="h-10 w-10">
        {data?.avatarUrl && <AvatarImage src={data.avatarUrl} alt={name} />}
        <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
      </Avatar>
    </Link>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/invoices/upload", label: "Upload", icon: Upload },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">IV</div>
            <span className="font-display font-semibold">InvoiceVision</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ to, label, icon: Icon }) => {
                  const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={to}><Icon /><span>{label}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild><Link to="/profile"><User /><span>Profile</span></Link></SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild><Link to="/settings"><Settings /><span>Settings</span></Link></SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut}><LogOut /><span>Sign out</span></SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b flex items-center gap-3 px-4 sticky top-0 bg-background/95 backdrop-blur z-30">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/invoices/upload">+ New invoice</Link></Button>
            <HeaderIdentity fallbackEmail={user.email ?? ""} />
          </div>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}
