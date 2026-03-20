"use client";

import { useEffect, useState } from "react";
import styles from "../../styles/module.module.css";
import { useRouter } from "next/navigation";
import apiTax from "@/src/lib/axiosCapcha";

export default function Module2LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [captchaSvg, setCaptchaSvg] = useState("");
    const [captchaKey, setCaptchaKey] = useState("");
    const [tokenTax, setTokenTax] = useState("");

    const router = useRouter();

    // 👉 Load captcha
    const loadCaptcha = async () => {
        try {
            const res = await apiTax.get("/captcha");
            setCaptchaSvg(res.data.content);
            setCaptchaKey(res.data.key);
        } catch (err) {
            console.error("Load captcha error", err);
        }
    };

    useEffect(() => {
        loadCaptcha();
    }, []);

    // 👉 Login
    const handleLogin = async () => {
        if (!username || !password || !captcha) {
            alert("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        try {
            const res = await apiTax.post("/security-taxpayer/authenticate", {
                username,
                password,
                cvalue: captcha,
                ckey: captchaKey,
            });

            // lưu token nếu có
            setTokenTax(res.data.token);
            router.push("/module2"); // chuyển sang trang bạn đang có
        } catch (err: any) {
            const message =
                err?.response?.data?.message || "Đăng nhập thất bại";
            alert(message);

            // reload captcha nếu sai
            loadCaptcha();
        }
    };

    return (
        <div className={styles.container}>
            <h1>Đăng nhập Thuế</h1>

            <div className={styles.uploadBox}>
                <div>
                    <label>Tài khoản</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div>
                    <label>Mật khẩu</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {/* CAPTCHA */}
                <div>
                    <label>Captcha</label>

                    {/* render SVG */}
                    <div
                        style={{
                            border: "1px solid #ccc",
                            display: "inline-block",
                            marginBottom: "10px",
                            cursor: "pointer"
                        }}
                        onClick={loadCaptcha}
                        dangerouslySetInnerHTML={{ __html: captchaSvg }}
                    />

                    <input
                        type="text"
                        placeholder="Nhập captcha"
                        value={captcha}
                        onChange={(e) => setCaptcha(e.target.value)}
                    />
                </div>
            </div>

            <button className={styles.button} onClick={handleLogin}>
                Đăng nhập
            </button>
            <div>{tokenTax} </div>
        </div>
    );
}