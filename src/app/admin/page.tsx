import { getCurrentUser } from "@/lib/auth";
import AdminTerminal from "@/components/AdminTerminal";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-term-bg p-6">
        <div className="crt max-w-xl w-full bg-term-panel border border-phosphor-red/40 rounded-md p-8 text-phosphor-red font-mono">
          <div>ERROR: ACCESS DENIED.</div>
          <div className="mt-2 text-phosphor-red/70">
            ADMIN AUTHORIZATION REQUIRED. THIS INCIDENT HAS BEEN LOGGED.
          </div>
        </div>
      </div>
    );
  }

  return <AdminTerminal adminUsername={user.username} />;
}
