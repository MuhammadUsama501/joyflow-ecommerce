import { useEffect, useState } from "react";
import { SESSION_EVENT, isAdminSession } from "@/lib/admin-auth";

export function useSession() {
  const [isAdmin, setIsAdmin] = useState<boolean>(isAdminSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => setIsAdmin(isAdminSession());
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  return { isAdmin, loading };
}
