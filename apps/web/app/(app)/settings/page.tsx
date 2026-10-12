import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { getSettings } from "@/lib/data/settings";
import { listStripProducts } from "@/lib/data/strips";
import { listUsers } from "@/lib/data/users";
import { PrototypeBanner } from "@/components/common/prototype-banner";
import { SettingsForm } from "@/components/settings/settings-form";
import { UsersTable } from "@/components/settings/users-table";
import { PermissionsMatrix } from "@/components/settings/permissions-matrix";
import { CvHealthCard, probeCvHealth } from "@/components/settings/cv-health";
import { SecurityNotes } from "@/components/settings/security-notes";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Everyone signed in can read; editing needs settings.manage (enforced again in the action).
  const user = await requireUser();
  const canEdit = can(user, "settings.manage");
  const canSeeUsers = can(user, "users.manage") || can(user, "settings.manage");

  const [settings, products, cv, users] = await Promise.all([getSettings(), listStripProducts(), probeCvHealth(), canSeeUsers ? listUsers() : Promise.resolve([])]);

  return (
    <AppShell user={{ displayName: user.displayName, roleKey: user.roleKey }} eyebrow="09 / Settings" title="Settings" actions={canEdit ? <Chip tone="signal">editable</Chip> : <Chip tone="muted">read-only</Chip>} onLogout={logoutAction}>
      <div className="flex flex-col gap-6">
        <PrototypeBanner variant="inline" detail="Settings change workflow defaults only. Nothing here can make a result clinically valid." />

        <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel eyebrow="Application" title="Workflow defaults">
              <SettingsForm settings={settings} products={products.map((p) => ({ id: p.id, name: p.name }))} canEdit={canEdit} />
            </Panel>

            <Panel eyebrow="Access" title="Roles and permissions" description="Fixed role → permission map (lib/auth/permissions.ts). Your role is highlighted." flush>
              <PermissionsMatrix currentRole={user.roleKey} />
            </Panel>

            {canSeeUsers ? (
              <Panel eyebrow="Users" title={`${users.length} account${users.length === 1 ? "" : "s"}`} description="Accounts are managed by the seed / CLI in this prototype; no self-service sign-up." flush>
                <UsersTable users={users} currentUserId={user.id} />
              </Panel>
            ) : (
              <Panel eyebrow="Users" title="Accounts">
                <p className="text-[12.5px] text-fg-4">Listing users requires settings.manage or users.manage.</p>
              </Panel>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <Panel eyebrow="CV service" title="Health check">
              <CvHealthCard result={cv} configuredUrl={settings.cvServiceUrl} />
            </Panel>
            <Panel eyebrow="Security" title="What is protected, what is not" flush>
              <div className="p-5 pt-0">
                <SecurityNotes />
              </div>
            </Panel>
          </div>
        </div>

        <PrototypeBanner />
      </div>
    </AppShell>
  );
}
