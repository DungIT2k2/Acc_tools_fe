"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/npsLookup.module.css";
import callApi, { getErrorMessageAsync } from "@/src/lib/axios";
import Tesseract from "tesseract.js";

type CaptchaInfo = {
    captchaId: string;
    expiresAt: number;
};

type CaptchaResponse = {
    captchaId: string;
    expiresAt: number | string;
    contentType: string;
    image: string;
};

type AccountType = "DN" | "CN";

// Hiện tại backend chỉ cần loại Doanh nghiệp, người dùng không phải chọn
const DEFAULT_ACCOUNT_TYPE: AccountType = "DN";

// expiresAt có thể là timestamp (giây/mili giây) hoặc chuỗi ISO
function parseExpiresAt(value: number | string): number {
    if (typeof value === "number") {
        return value < 1e12 ? value * 1000 : value;
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? Date.now() + 5 * 60 * 1000 : time;
}

function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type NpsLoginFormProps = {
    initialUsername?: string;
    initialError?: string | null;
    onSuccess: (username: string) => void;
};

export default function NpsLoginForm({ initialUsername = "", initialError = null, onSuccess }: NpsLoginFormProps) {
    const [captchaInfo, setCaptchaInfo] = useState<CaptchaInfo | null>(null);
    const [captchaImageUrl, setCaptchaImageUrl] = useState<string | null>(null);
    const [username, setUsername] = useState(initialUsername);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [captchaValue, setCaptchaValue] = useState("");
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [loadingLogin, setLoadingLogin] = useState(false);
    const [error, setError] = useState<string | null>(initialError);
    const [now, setNow] = useState(() => Date.now());
    const captchaRequestRef = useRef<Promise<void> | null>(null);

    const remainingMs = captchaInfo ? captchaInfo.expiresAt - now : 0;
    const isExpired = Boolean(captchaInfo) && remainingMs <= 0;

    const loadCaptcha = useCallback(async (keepError = false) => {
        if (captchaRequestRef.current) {
            return captchaRequestRef.current;
        }

        setLoadingCaptcha(true);
        if (!keepError) {
            setError(null);
        }

        const request = (async () => {
            try {
                const res = await callApi.get("/nps/captcha");
                const { captchaId, expiresAt, contentType, image } = res.data as CaptchaResponse;
                const url = `data:${contentType};base64,${image}`;

                setCaptchaInfo({ captchaId, expiresAt: parseExpiresAt(expiresAt) });
                setCaptchaImageUrl(url);
                setNow(Date.now());

                try {
                    const { data: { text } } = await Tesseract.recognize(url, "eng");
                    setCaptchaValue(text.trim());
                } catch {
                    setCaptchaValue("");
                    setError("Không thể tự nhận diện captcha. Vui lòng nhập captcha theo hình.");
                }
            } catch (err) {
                setCaptchaInfo(null);
                setCaptchaImageUrl(null);
                const message = await getErrorMessageAsync(err, "Không thể tải captcha. Vui lòng thử lại.");
                setError(message);
            } finally {
                setLoadingCaptcha(false);
            }
        })();

        captchaRequestRef.current = request;
        const clearRequest = () => {
            if (captchaRequestRef.current === request) {
                captchaRequestRef.current = null;
            }
        };
        void request.then(clearRequest, clearRequest);

        return request;
    }, []);

    useEffect(() => {
        loadCaptcha(true);
    }, [loadCaptcha]);

    useEffect(() => {
        if (!captchaInfo) {
            return;
        }
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [captchaInfo]);

    const handleLogin = async () => {
        if (loadingLogin) {
            return;
        }
        if (loadingCaptcha || captchaRequestRef.current) {
            setError("Vui lòng chờ captcha tải xong trước khi đăng nhập.");
            return;
        }
        if (!captchaInfo) {
            setError("Vui lòng tải captcha trước khi đăng nhập.");
            return;
        }
        if (isExpired) {
            setError("Phiên captcha đã hết hạn. Đang tải captcha mới...");
            loadCaptcha(true);
            return;
        }
        if (!username.trim()) {
            setError("Vui lòng nhập tên đăng nhập.");
            return;
        }
        if (!password) {
            setError("Vui lòng nhập mật khẩu.");
            return;
        }
        if (!captchaValue.trim()) {
            setError("Vui lòng nhập mã captcha.");
            return;
        }

        setLoadingLogin(true);
        setError(null);

        try {
            await callApi.post("/nps/login", {
                captchaId: captchaInfo.captchaId,
                username: username.trim(),
                password,
                captcha: captchaValue.trim(),
                type: DEFAULT_ACCOUNT_TYPE,
            });
            onSuccess(username.trim());
        } catch (err) {
            const message = await getErrorMessageAsync(err, "Đăng nhập thất bại. Vui lòng thử lại.");
            setError(message);
            loadCaptcha(true);
        } finally {
            setLoadingLogin(false);
        }
    };

    const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            void handleLogin();
        }
    };

    return (
        <>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="nps-username">Tên đăng nhập</label>
                <input
                    id="nps-username"
                    className={styles.input}
                    type="text"
                    placeholder="Nhập tên đăng nhập (MST)"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={onEnter}
                />
            </div>

            <div className={styles.field}>
                <label className={styles.label} htmlFor="nps-password">Mật khẩu</label>
                <div className={styles.passwordBox}>
                    <input
                        id="nps-password"
                        className={styles.input}
                        type={showPassword ? "text" : "password"}
                        placeholder="Nhập mật khẩu"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={onEnter}
                    />
                    <button
                        type="button"
                        className={styles.togglePasswordBtn}
                        onClick={() => setShowPassword((prev) => !prev)}
                    >
                        {showPassword ? "Ẩn" : "Hiện"}
                    </button>
                </div>
            </div>

            <div className={styles.field}>
                <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="nps-captcha">Mã captcha</label>
                    {captchaInfo && (
                        <span className={isExpired ? styles.expiredText : styles.countdownText}>
                            {isExpired ? "Đã hết hạn" : `Hết hạn sau ${formatRemaining(remainingMs)}`}
                        </span>
                    )}
                </div>
                <div className={styles.captchaRow}>
                    <div
                        className={`${styles.captchaImageBox} ${isExpired ? styles.captchaExpired : ""}`}
                        onClick={() => loadCaptcha()}
                        title="Nhấn để tải captcha mới"
                    >
                        {captchaImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={captchaImageUrl} alt="Captcha" className={styles.captchaImage} />
                        ) : (
                            <span className={styles.captchaPlaceholder}>
                                {loadingCaptcha ? "Đang tải..." : "Không có captcha"}
                            </span>
                        )}
                    </div>
                    <input
                        id="nps-captcha"
                        className={styles.input}
                        type="text"
                        placeholder="Nhập captcha"
                        autoComplete="off"
                        value={captchaValue}
                        onChange={(e) => setCaptchaValue(e.target.value)}
                        onKeyDown={onEnter}
                    />
                    <button
                        className={styles.refreshBtn}
                        onClick={() => loadCaptcha()}
                        disabled={loadingCaptcha}
                        title="Tải captcha mới"
                        type="button"
                    >
                        <span className={loadingCaptcha ? styles.refreshBtnSpinning : ""}>↻</span>
                    </button>
                </div>
            </div>

            <button
                className={styles.submitBtn}
                onClick={handleLogin}
                disabled={loadingLogin || loadingCaptcha}
            >
                {loadingLogin && <span className={styles.spinner} />}
                {loadingLogin ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            {error && <p className={styles.errorMsg}>{error}</p>}
        </>
    );
}
