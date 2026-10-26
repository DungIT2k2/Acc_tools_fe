"use client";

import { useCallback, useEffect, useState } from "react";
import callApi from "../lib/axios";
import styles from "../styles/ConnectionStatus.module.css";
import MaintenancePage from "./MaintenancePage";

const CONNECTION_CHECK_INTERVAL = 10 * 60 * 1000;
const MAINTENANCE_CHECK_INTERVAL = 30 * 1000;
const DEFAULT_MAINTENANCE_MESSAGE = "Hệ thống đang bảo trì";

type SystemStatus = "up" | "maintenance" | "disconnected";

type ConnectionStatusProps = {
  children: React.ReactNode;
};

export default function ConnectionStatus({ children }: ConnectionStatusProps) {
  const [status, setStatus] = useState<SystemStatus>("disconnected");
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await callApi.get("/system/status");
      setStatus(response.status === 200 && response.data?.status === "UP" ? "up" : "disconnected");
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { message?: unknown } } }).response;

      if (response?.status === 503) {
        const message = response.data?.message;
        setMaintenanceMessage(typeof message === "string" && message ? message : DEFAULT_MAINTENANCE_MESSAGE);
        setStatus("maintenance");
      } else {
        setStatus("disconnected");
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkConnection();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [checkConnection]);

  useEffect(() => {
    // Khi đang bảo trì thì kiểm tra dày hơn để tự quay lại khi hệ thống hoạt động
    const interval = status === "maintenance" ? MAINTENANCE_CHECK_INTERVAL : CONNECTION_CHECK_INTERVAL;
    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, interval);

    return () => window.clearInterval(intervalId);
  }, [status, checkConnection]);

  if (status === "maintenance") {
    return (
      <MaintenancePage
        message={maintenanceMessage}
        isChecking={isChecking}
        onRetry={() => void checkConnection()}
      />
    );
  }

  const isConnected = status === "up";

  return (
    <>
      <div className={styles.container} aria-live="polite">
        <span
          className={`${styles.dot} ${isConnected ? styles.connected : styles.disconnected}`}
          aria-hidden="true"
        />
        <span className={styles.label}>
          {isConnected ? "Đã kết nối" : "Chưa kết nối"}
        </span>
      </div>
      {children}
    </>
  );
}
