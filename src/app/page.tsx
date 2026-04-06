"use client";

import { useEffect, useRef, useState } from "react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [isBearCovered, setIsBearCovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const shouldCoverBearEyes = isBearCovered || showPassword;

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
          <div className={styles.bearWrap}>
            <button
              type="button"
              className={styles.bearButton}
              onClick={() => setIsBearCovered((prev) => !prev)}
              aria-label={shouldCoverBearEyes ? "Gấu mở mắt" : "Gấu che mắt"}
              aria-pressed={shouldCoverBearEyes}
            >
              <div className={`${styles.bearFace} ${shouldCoverBearEyes ? styles.bearFaceCover : ""}`}>
                <span className={`${styles.bearEar} ${styles.bearEarLeft}`}></span>
                <span className={`${styles.bearEar} ${styles.bearEarRight}`}></span>

                <div className={styles.bearHead}>
                  <span className={`${styles.bearEye} ${styles.bearEyeLeft}`}></span>
                  <span className={`${styles.bearEye} ${styles.bearEyeRight}`}></span>
                  <span className={styles.bearNose}></span>
                  <span className={styles.bearMouth}></span>
                </div>

                <span className={`${styles.bearPaw} ${styles.bearPawLeft}`}></span>
                <span className={`${styles.bearPaw} ${styles.bearPawRight}`}></span>
              </div>
            </button>
          </div>

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
              <div className={styles.passwordField}>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  className={`${styles.input} ${styles.passwordInput}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                />

                <button
                  type="button"
                  className={styles.passwordToggle}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setShowPassword((prev) => !prev);
                    passwordInputRef.current?.focus();
                  }}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className={styles.passwordIcon} aria-hidden="true">
                      <path
                        d="M3 3l18 18m-2.2-5.2A10.7 10.7 0 0 0 22 12s-3.6-7-10-7a10.8 10.8 0 0 0-4.6 1m-2.2 2.2A14.2 14.2 0 0 0 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4.2-.8M9.9 9.9A3 3 0 0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className={styles.passwordIcon} aria-hidden="true">
                      <path
                        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
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