"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken, fetchSystemStatus, MAINTENANCE_PATH } from "../lib/systemStatus";
import styles from "../styles/ConnectionStatus.module.css";

const CONNECTION_CHECK_INTERVAL = 10 * 60 * 1000;

export default function ConnectionStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const isMaintenancePage = pathname === MAINTENANCE_PATH;
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Trang bảo trì tự kiểm tra trạng thái riêng
    if (isMaintenancePage) {
      return;
    }

    let isMounted = true;

    const checkConnection = async () => {
      const result = await fetchSystemStatus();

      if (!isMounted) {
        return;
      }

      if (result.status === "maintenance") {
        clearAuthToken();
        router.replace(MAINTENANCE_PATH);
        return;
      }

      setIsConnected(result.status === "up");
    };

    void checkConnection();

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, CONNECTION_CHECK_INTERVAL);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isMaintenancePage, router]);

  if (isMaintenancePage) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="polite">
      <span
        className={`${styles.dot} ${isConnected ? styles.connected : styles.disconnected}`}
        aria-hidden="true"
      />
      <span className={styles.label}>
        {isConnected ? "Đã kết nối" : "Chưa kết nối"}
      </span>
    </div>
  );
}
