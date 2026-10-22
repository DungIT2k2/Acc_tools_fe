"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../styles/npsLookup.module.css";
import NpsLoginForm from "@/src/components/NpsLoginForm";
import NpsSearchPanel from "@/src/components/NpsSearchPanel";

type NpsSession = {
    username: string;
    loggedInAt: number;
};

const NPS_SESSION_KEY = "nps_session";
// Phiên Dịch vụ công trên backend tồn tại tối đa 1 giờ
const NPS_SESSION_TTL_MS = 60 * 60 * 1000;

function readStoredSession(): NpsSession | null {
    try {
        const raw = sessionStorage.getItem(NPS_SESSION_KEY);
        if (!raw) {
            return null;
        }
        const session = JSON.parse(raw) as NpsSession;
        if (!session?.username || Date.now() - session.loggedInAt > NPS_SESSION_TTL_MS) {
            sessionStorage.removeItem(NPS_SESSION_KEY);
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

function writeStoredSession(session: NpsSession | null) {
    try {
        if (session) {
            sessionStorage.setItem(NPS_SESSION_KEY, JSON.stringify(session));
        } else {
            sessionStorage.removeItem(NPS_SESSION_KEY);
        }
    } catch {
        // Bỏ qua khi trình duyệt chặn storage, chỉ mất khả năng giữ phiên khi tải lại trang
    }
}

export default function NpsLookupPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [session, setSession] = useState<NpsSession | null>(null);
    const [lastUsername, setLastUsername] = useState("");
    const [loginNotice, setLoginNotice] = useState<string | null>(null);

    useEffect(() => {
        const stored = readStoredSession();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage chỉ đọc được sau khi mount
        setSession(stored);
        setLastUsername(stored?.username ?? "");
        setReady(true);
    }, []);

    const handleLoginSuccess = (username: string) => {
        const nextSession = { username, loggedInAt: Date.now() };
        writeStoredSession(nextSession);
        setLastUsername(username);
        setLoginNotice(null);
        setSession(nextSession);
    };

    const endSession = useCallback((notice: string | null) => {
        setSession(null);
        writeStoredSession(null);
        setLoginNotice(notice);
    }, []);

    const handleSessionExpired = useCallback(
        (message: string) => endSession(message || "Phiên đăng nhập Dịch vụ công đã hết hạn, vui lòng đăng nhập lại."),
        [endSession],
    );

    return (
        <div className={styles.page}>
            <div className={`${styles.card} ${session ? styles.cardWide : ""}`}>
                <button className={styles.backBtn} onClick={() => router.push("/menu")}>
                    ← Quay lại menu
                </button>
                <h1 className={styles.title}>Tra cứu hồ sơ</h1>
                <p className={styles.subtitle}>
                    {session
                        ? "Tra cứu danh sách hồ sơ đã nộp trên Dịch vụ công Cục Thuế"
                        : "Đăng nhập tài khoản Dịch vụ công Cục Thuế để tra cứu hồ sơ"}
                </p>

                {!ready ? null : session ? (
                    <>
                        <div className={styles.sessionBar}>
                            <span>
                                Đang đăng nhập Dịch vụ công: <strong>{session.username}</strong>
                            </span>
                            <button type="button" className={styles.secondaryBtn} onClick={() => endSession(null)}>
                                Đổi tài khoản
                            </button>
                        </div>
                        <NpsSearchPanel
                            key={session.loggedInAt}
                            username={session.username}
                            onSessionExpired={handleSessionExpired}
                        />
                    </>
                ) : (
                    <NpsLoginForm
                        key={loginNotice ?? "login"}
                        initialUsername={lastUsername}
                        initialError={loginNotice}
                        onSuccess={handleLoginSuccess}
                    />
                )}
            </div>
        </div>
    );
}
