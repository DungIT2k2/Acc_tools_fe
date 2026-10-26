"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MaintenancePage from "../../components/MaintenancePage";
import { clearAuthToken, DEFAULT_MAINTENANCE_MESSAGE, fetchSystemStatus } from "../../lib/systemStatus";

const MAINTENANCE_CHECK_INTERVAL = 30 * 1000;

export default function Maintenance() {
  const router = useRouter();
  const [message, setMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const result = await fetchSystemStatus();
    setIsChecking(false);

    if (result.status === "maintenance") {
      clearAuthToken();
      setMessage(result.message);
      return;
    }

    // Hệ thống hoạt động lại: quay về trang đăng nhập
    if (result.status === "up") {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    clearAuthToken();

    const timeoutId = window.setTimeout(() => {
      void checkStatus();
    }, 0);

    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, MAINTENANCE_CHECK_INTERVAL);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [checkStatus]);

  return <MaintenancePage message={message} isChecking={isChecking} onRetry={() => void checkStatus()} />;
}
