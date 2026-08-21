"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTokenExpiry, isTokenValid } from "../lib/jwt";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/";
  const [authorizedPathname, setAuthorizedPathname] = useState<string | null>(null);

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token || !isTokenValid(token)) {
      localStorage.removeItem("access_token");
      router.replace("/");
      return;
    }

    const authorizationId = window.setTimeout(() => {
      setAuthorizedPathname(pathname);
    }, 0);

    const expiry = getTokenExpiry(token);
    const timeoutId = window.setTimeout(() => {
      localStorage.removeItem("access_token");
      router.replace("/");
    }, Math.max(0, (expiry! * 1000) - Date.now()));

    return () => {
      window.clearTimeout(authorizationId);
      window.clearTimeout(timeoutId);
    };
  }, [isLoginPage, pathname, router]);

  return isLoginPage || authorizedPathname === pathname ? children : null;
}