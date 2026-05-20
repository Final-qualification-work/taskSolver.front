"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      const token = getAuthToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        await api.getMe();
        if (!cancelled) setIsChecking(false);
      } catch {
        clearAuthToken();
        router.replace("/login");
      }
    }

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Проверка авторизации...
      </main>
    );
  }

  return <>{children}</>;
}
