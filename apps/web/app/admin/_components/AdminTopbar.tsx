import { ShieldCheck } from "lucide-react";

export function AdminTopbar({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-brand-line bg-white px-5 lg:px-8">
      <div className="flex items-center gap-2 text-[12px] font-medium text-brand-mute">
        <ShieldCheck className="h-4 w-4 text-brand-primary" />
        <span>Vilo Admin · {prettyRole(role)} session</span>
      </div>
      <div className="text-[12px] text-brand-mute">{email}</div>
    </div>
  );
}

function prettyRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "support_agent":
      return "Support";
    case "finance":
      return "Finance";
    case "content_mod":
      return "Content Mod";
    case "ops":
      return "Ops";
    default:
      return role;
  }
}
