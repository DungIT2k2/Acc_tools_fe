"use client";

import { useState } from "react";
import styles from "../styles/Login.module.css";
import callApi from "../lib/axios";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const res = await callApi.post("/auth/login", { username, password });
    console.log("Email:", username, "Password:", password);
    console.log("Login success:", res.data);
    alert("Đăng nhập thành công");
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h2 className={styles.title}>Đăng nhập</h2>
        <form onSubmit={handleLogin}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Tài khoản</label>
            <input
              type="account"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              required
            />
          </div>

          <button type="submit" className={styles.button}>Đăng nhập</button>
        </form>
      </div>
    </div>
  );
}