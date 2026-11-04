"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./Icons";
import styles from "../styles/ThemeToggle.module.css";

type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

// Nguồn sự thật là thuộc tính data-theme trên <html> (được set bởi script trong <head>)
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const getServerSnapshot = (): Theme => "light";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={isDark ? "Giao diện sáng" : "Giao diện tối"}
    >
      {isDark ? <MoonIcon size={20} /> : <SunIcon size={20} />}
    </button>
  );
}
