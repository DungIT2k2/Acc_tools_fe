"use client";

import { useEffect, useState } from "react";
import callApi from "../lib/axios";
import styles from "../styles/ConnectionStatus.module.css";

const CONNECTION_CHECK_INTERVAL = 10 * 60 * 1000;

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      try {
        const response = await callApi.get("/");

        if (isMounted) {
          setIsConnected(response.status === 200);
        }
      } catch {
        if (isMounted) {
          setIsConnected(false);
        }
      }
    };

    void checkConnection();

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, CONNECTION_CHECK_INTERVAL);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

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