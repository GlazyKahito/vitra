import type { SafeUser } from "@/lib/data/contract";
import { Chip } from "@/components/ui/chip";
import { ROLE_LABELS, isRoleKey } from "@/lib/auth/permissions";

export function UsersTable({ users, currentUserId }: { users: SafeUser[]; currentUserId: string }) {
  if (users.length === 0) return <p className="px-5 py-6 text-[12.5px] text-fg-4">No users.</p>;
  return (
    <table className="table-instrument">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="text-fg">
              {u.displayName}
              {u.id === currentUserId ? <span className="ml-2 t-mono text-[10.5px] text-fg-4">you</span> : null}
            </td>
            <td className="t-mono text-[12px]">{u.email}</td>
            <td>
              <span title={isRoleKey(u.roleKey) ? ROLE_LABELS[u.roleKey].description : undefined}>{isRoleKey(u.roleKey) ? ROLE_LABELS[u.roleKey].label : u.roleKey}</span>
            </td>
            <td>{u.active ? <Chip tone="neutral">active</Chip> : <Chip tone="muted">inactive</Chip>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
