"use client";

import { useEffect, useState } from "react";
import styles from "../styles/Login.module.css";
import callApi from "../lib/axios";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { decodeTokenPayload } from "../lib/jwt";

type JwtPayload = {
  exp?: number;
};

function isTokenValid(token: string) {
  const payload = decodeTokenPayload<JwtPayload>(token);

  if (!payload) {
    return false;
  }

  if (typeof payload.exp !== "number") {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowInSeconds;
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await callApi.post("/auth/login", { username, password });

      const accessToken = res.data?.access_token;
      localStorage.setItem("access_token", accessToken);

      router.push("/menu");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message =
        error?.response?.data?.message || "Có lỗi xảy ra";

      alert(message);
    } finally {
      setLoading(false);
    }

  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      return;
    }

    if (isTokenValid(token)) {
      router.replace("/menu");
      return;
    }

    localStorage.removeItem("access_token");
  }, [router]);

  return (
    <div className={styles.container}>
      <div className={styles.shell}>
        <div className={styles.loginBox}>
          <h2 className={styles.title}>Đăng nhập hệ thống</h2>
          <p className={styles.subTitle}>Sử dụng tài khoản nội bộ để tiếp tục</p>

          <form onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Tài khoản</label>
              <input
                type="text"
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tài khoản"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Mật khẩu</label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading && <span className={styles.spinner}></span>}
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}