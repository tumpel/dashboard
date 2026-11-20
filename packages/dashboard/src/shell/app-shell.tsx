import { Link, Outlet, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  BlocksIcon,
  BotIcon,
  ChartLineIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleUserIcon,
  KeyRoundIcon,
  LayersIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PackageIcon,
  PlugIcon,
  PlusIcon,
  ServerIcon,
  TerminalIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ApiFailure, type Failure, failureOf } from "../api/port";
import { wordingOf } from "../api/wording";
import { Logo } from "../components/logo";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Toaster } from "../components/ui/sonner";
import { useDashboard, useSignedOut } from "../context";
import { useHashDialog } from "../hash-dialog";
import { useLiveEvents, useTenants, useWhoami } from "../queries";
import { SwitchingNotice, type SwitchTarget, useSwitchTenant } from "./switch-tenant";

const OVERVIEW = { to: "/t/$tenantId/overview", label: "Overview", icon: LayoutDashboardIcon } as const;
const METRICS = { to: "/t/$tenantId/metrics", label: "Metrics", icon: ChartLineIcon } as const;
const SESSIONS = { to: "/t/$tenantId/sessions", label: "Sessions", icon: TerminalIcon } as const;
const HOSTS = { to: "/t/$tenantId/hosts", label: "Hosts", icon: ServerIcon } as const;
const HARNESSES = { to: "/t/$tenantId/harnesses", label: "Harnesses", icon: LayersIcon } as const;
const PERSONAS = { to: "/t/$tenantId/personas", label: "Personas", icon: BotIcon } as const;
const TRIGGERS = { to: "/t/$tenantId/triggers", label: "Triggers", icon: ZapIcon } as const;
const SECRETS = { to: "/t/$tenantId/secrets", label: "Secret sets", icon: KeyRoundIcon } as const;
const CONNECTIONS = { to: "/t/$tenantId/connections", label: "Connections", icon: PlugIcon } as const;
const CONNECTORS = { to: "/t/$tenantId/connectors", label: "Connectors", icon: BlocksIcon } as const;
const PREBUILDS = { to: "/t/$tenantId/prebuilds", label: "Prebuilds", icon: PackageIcon } as const;
const MEMBERS = { to: "/t/$tenantId/members", label: "Members", icon: UsersIcon } as const;
const ACCOUNT = { to: "/t/$tenantId/account", label: "Account", icon: CircleUserIcon } as const;

const SECTIONS = [
  OVERVIEW,
  SESSIONS,
  HOSTS,
  METRICS,
  HARNESSES,
  PERSONAS,
  TRIGGERS,
  SECRETS,
  CONNECTIONS,
  CONNECTORS,
  PREBUILDS,
  MEMBERS,
] as const;
const MORE_SECTIONS = [
  METRICS,
  PREBUILDS,
  PERSONAS,
  TRIGGERS,
  HARNESSES,
  SECRETS,
  CONNECTIONS,
  CONNECTORS,
  MEMBERS,
  ACCOUNT,
] as const;
const MORE_HASH = "more";

const TAB_CLASS = "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground";
const TAB_ACTIVE = { className: "font-semibold text-foreground" };

const PhoneTabs = ({ tenantId }: { tenantId: string }) => {
  const sheet = useHashDialog();
  const tab = ({ to, label, icon: Icon }: typeof OVERVIEW | typeof SESSIONS | typeof HOSTS) => (
    <Link key={to} to={to} params={{ tenantId }} className={TAB_CLASS} activeProps={TAB_ACTIVE}>
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
  return (
    <>
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 flex border-t bg-card lg:hidden">
        {tab(OVERVIEW)}
        {tab(SESSIONS)}
        <Link
          to="/t/$tenantId/sessions/new"
          params={{ tenantId }}
          search={{ source: [], persona: [], repo: [], issue: [], model: [], prompt: [] }}
          className={TAB_CLASS}
          activeProps={TAB_ACTIVE}
        >
          <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
            <PlusIcon className="size-4" aria-hidden />
          </span>
          Start
        </Link>
        {tab(HOSTS)}
        <Link
          to="."
          hash={MORE_HASH}
          search={(search) => search}
          className={TAB_CLASS}
          aria-haspopup="dialog"
          aria-expanded={sheet.isOpen(MORE_HASH)}
        >
          <MenuIcon className="size-5" aria-hidden />
          More
        </Link>
      </nav>
      <Dialog open={sheet.isOpen(MORE_HASH)} onOpenChange={(next) => !next && sheet.close()}>
        <DialogContent
          aria-describedby={undefined}
          className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 gap-2 rounded-b-none p-4 lg:hidden"
        >
          <DialogTitle>More</DialogTitle>
          <nav aria-label="More sections" className="grid gap-2">
            {MORE_SECTIONS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                params={{ tenantId }}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                activeProps={{ className: "font-semibold text-foreground" }}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
};

const useSignOut = (): (() => void) => {
  const { ports, signedOut } = useDashboard();
  return () =>
    void ports.auth.signOut().then((failure) => {
      signedOut.set(true);
      if (failure === null) return;
      const wording = wordingOf(failure);
      toast.error(wording.title, { description: `${wording.detail} ${wording.fix}` });
    });
};

const TenantSwitcher = ({
  tenantId,
  tenantName,
  switchTo,
  holdsToken,
}: {
  tenantId: string;
  tenantName: string;
  switchTo: (target: SwitchTarget) => void;
  holdsToken: (target: SwitchTarget) => boolean;
}) => {
  const signOut = useSignOut();
  const tenants = useTenants(tenantId);
  const listed = tenants.isSuccess
    ? tenants.data.map((membership) => {
        const target = { tenantId: membership.tenant.tenantId, name: membership.tenant.name };
        const held = target.tenantId === tenantId || holdsToken(target);
        return { ...target, status: `${membership.role}, ${held ? "signed in" : "sign-in needed"}` };
      })
    : [{ tenantId, name: tenantName, status: "Signed in" }];
  const failed = tenants.isError ? wordingOf(failureOf(tenants.error)) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-64 justify-between gap-2 font-semibold">
          <span className="truncate">{tenantName}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuLabel>Your tenants</DropdownMenuLabel>
        {listed.map((tenant) => (
          <DropdownMenuItem key={tenant.tenantId} onSelect={() => switchTo(tenant)}>
            <span className="grid flex-1">
              <span className="font-medium">{tenant.name}</span>
              <span className="text-xs text-muted-foreground">{tenant.status}</span>
            </span>
            {tenant.tenantId === tenantId && <CheckIcon aria-label="current" />}
          </DropdownMenuItem>
        ))}
        {tenants.isPending && <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading your tenants...</p>}
        {failed !== null && (
          <>
            <div role="alert" className="grid max-w-64 gap-0.5 px-2 py-1.5 text-xs">
              <span className="font-semibold text-destructive">{failed.title}</span>
              <span>{failed.detail}</span>
              <span className="text-muted-foreground">{failed.fix}</span>
            </div>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void tenants.refetch();
              }}
            >
              Retry
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Sign out of all tenants</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AccountMenu = ({ tenantId, email, role }: { tenantId: string; email: string; role: string }) => {
  const signOut = useSignOut();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full" aria-label={`Account ${email}`}>
          {email.slice(0, 1).toUpperCase() || "?"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-sm text-foreground">{email}</span>
          <span className="block">{role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/t/$tenantId/account", params: { tenantId } })}>
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SignedOutNotice = () => {
  const { ports } = useDashboard();
  const location = useLocation();
  const [failure, setFailure] = useState<Failure | null>(null);
  return (
    <div role="alert" className="border-b-2 border-destructive bg-card px-4 py-3 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">You are signed out</h2>
          <p className="text-sm text-muted-foreground">
            The sign-in for this tenant ended or was revoked. Nothing on this page updates until you sign in again.
          </p>
        </div>
        <Button onClick={() => void ports.auth.signIn(location.href).then(setFailure)}>Sign in again</Button>
      </div>
      {failure !== null && <ProblemBlock className="mt-3" error={new ApiFailure(failure)} />}
    </div>
  );
};

export const AppShell = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId" });
  const { ports } = useDashboard();
  const signedOut = useSignedOut();
  const whoami = useWhoami(tenantId);
  useLiveEvents(tenantId);
  const stored = ports.auth.signedInTenants().find((tenant) => tenant.tenantId === tenantId);
  const tenantName = whoami.data?.tenant.name ?? stored?.tenantName ?? tenantId;
  const email = whoami.data?.principal.email ?? stored?.email ?? "";
  const role = whoami.data?.principal.role ?? "";
  const { switching, holdsToken, switchTo } = useSwitchTenant(tenantId);
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r bg-sidebar p-4 text-sidebar-foreground lg:flex">
        <Link to="/t/$tenantId/overview" params={{ tenantId }} aria-label="Overview">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="grid gap-1">
          {SECTIONS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              params={{ tenantId }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-semibold text-foreground" }}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          to={ACCOUNT.to}
          params={{ tenantId }}
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          activeProps={{ className: "bg-sidebar-accent font-semibold text-foreground" }}
        >
          <ACCOUNT.icon className="size-4" aria-hidden />
          {ACCOUNT.label}
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-card px-4">
          <span className="lg:hidden">
            <img src="/logo128.png" alt="" width={24} height={24} />
          </span>
          <TenantSwitcher tenantId={tenantId} tenantName={tenantName} switchTo={switchTo} holdsToken={holdsToken} />
          <div className="flex-1" />
          <AccountMenu tenantId={tenantId} email={email} role={role} />
        </header>
        {signedOut && <SignedOutNotice />}
        {switching !== null && (
          <div className="border-b px-4 py-3 lg:px-6">
            <SwitchingNotice switching={switching} onRetry={() => switchTo(switching.target)} />
          </div>
        )}
        <main inert={signedOut} className="flex-1 p-4 pb-24 data-[inert=true]:opacity-50 lg:p-6" data-inert={signedOut}>
          <Outlet />
        </main>
      </div>
      <PhoneTabs tenantId={tenantId} />
      <Toaster />
    </div>
  );
};
