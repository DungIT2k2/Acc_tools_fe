"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../styles/taxLookup.module.css";
import callApi, { getErrorMessageAsync } from "@/src/lib/axios";

type CaptchaInfo = {
    lookupId: string;
    expiresAt: number;
};

type CaptchaResponse = CaptchaInfo & {
    contentType: string;
    image: string;
};

type EntityType = "DN" | "CN";

type TaxLookupItem = {
    STT: string;
    MST: string;
    "Tên người nộp thuế": string;
    "Địa chỉ trụ sở/địa chỉ kinh doanh": string;
    "Cơ quan thuế quản lý": string;
    "Trạng thái MST": string;
};

// Backend wraps the array of matches in the "information" field of the response
function normalizeLookupResult(data: unknown): TaxLookupItem[] {
    const information = (data as { information?: unknown })?.information;
    if (Array.isArray(information)) {
        return information as TaxLookupItem[];
    }
    if (Array.isArray(data)) {
        return data as TaxLookupItem[];
    }
    return [];
}

export default function TaxLookupPage() {
    const [captchaInfo, setCaptchaInfo] = useState<CaptchaInfo | null>(null);
    const [captchaImageUrl, setCaptchaImageUrl] = useState<string | null>(null);
    const [entityType, setEntityType] = useState<EntityType>("DN");
    const [taxCode, setTaxCode] = useState("");
    const [captchaValue, setCaptchaValue] = useState("");
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TaxLookupItem[] | null>(null);

    const loadCaptcha = useCallback(async (keepError = false) => {
        setLoadingCaptcha(true);
        if (!keepError) {
            setError(null);
        }
        try {
            const infoRes = await callApi.get("/tax/captcha", { params: { type: entityType } });
            const { lookupId, expiresAt, contentType, image } = infoRes.data as CaptchaResponse;
            const url = `data:${contentType};base64,${image}`;

            setCaptchaInfo({ lookupId, expiresAt });
            setCaptchaImageUrl(url);
            setCaptchaValue("");
        } catch (err) {
            const message = await getErrorMessageAsync(err, "Không thể tải captcha. Vui lòng thử lại.");
            setError(message);
        } finally {
            setLoadingCaptcha(false);
        }
    }, [entityType]);

    useEffect(() => {
        loadCaptcha();
    }, [loadCaptcha]);

    const handleSearch = async () => {
        if (!captchaInfo) {
            setError("Vui lòng tải captcha trước khi tìm kiếm.");
            return;
        }
        if (!taxCode.trim()) {
            setError("Vui lòng nhập mã số thuế.");
            return;
        }
        if (!captchaValue.trim()) {
            setError("Vui lòng nhập mã captcha.");
            return;
        }

        setLoadingSearch(true);
        setError(null);
        setResult(null);

        try {
            const res = await callApi.post("/tax/lookup", {
                lookupId: captchaInfo.lookupId,
                taxCode: taxCode.trim(),
                captcha: captchaValue.trim(),
                type: entityType,
            });
            setResult(normalizeLookupResult(res.data));
            loadCaptcha(true);
        } catch (err) {
            const message = await getErrorMessageAsync(err, "Tra cứu thất bại. Vui lòng thử lại.");
            setError(message);
            loadCaptcha(true);
        } finally {
            setLoadingSearch(false);
        }
    };

    const router = useRouter();

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <button className={styles.backBtn} onClick={() => router.push("/menu")}>
                    ← Quay lại menu
                </button>
                <h1 className={styles.title}>Tra cứu mã số thuế</h1>
                <p className={styles.subtitle}>Nhập mã số thuế và mã captcha để tra cứu thông tin</p>

                <div className={styles.field}>
                    <label className={styles.label}>Loại tìm kiếm</label>
                    <div className={styles.checkboxRow}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={entityType === "DN"}
                                onChange={() => setEntityType("DN")}
                            />
                            Doanh nghiệp
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={entityType === "CN"}
                                onChange={() => setEntityType("CN")}
                            />
                            Cá nhân
                        </label>
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Mã số thuế</label>
                    <input
                        className={styles.input}
                        type="text"
                        placeholder="Nhập mã số thuế"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSearch();
                        }}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Mã captcha</label>
                    <div className={styles.captchaRow}>
                        <div className={styles.captchaImageBox} onClick={() => loadCaptcha()} title="Nhấn để tải captcha mới">
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
                            className={styles.input}
                            type="text"
                            placeholder="Nhập captcha"
                            value={captchaValue}
                            onChange={(e) => setCaptchaValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearch();
                            }}
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

                <button className={styles.submitBtn} onClick={handleSearch} disabled={loadingSearch}>
                    {loadingSearch && <span className={styles.spinner} />}
                    {loadingSearch ? "Đang tra cứu..." : "Tìm kiếm"}
                </button>

                {error && <p className={styles.errorMsg}>{error}</p>}

                {result && (
                    <div className={styles.resultBox}>
                        <div className={styles.resultHeader}>Kết quả tra cứu ({result.length} đơn vị)</div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.resultTable}>
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã số thuế</th>
                                        <th>Tên người nộp thuế</th>
                                        <th>Địa chỉ</th>
                                        <th>Cơ quan thuế quản lý</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.map((item) => {
                                        const isActive = item["Trạng thái MST"]?.startsWith("NNT đang hoạt động");
                                        return (
                                            <tr key={item.STT}>
                                                <td>{item.STT}</td>
                                                <td>{item.MST}</td>
                                                <td>{item["Tên người nộp thuế"]}</td>
                                                <td>{item["Địa chỉ trụ sở/địa chỉ kinh doanh"]}</td>
                                                <td>{item["Cơ quan thuế quản lý"]}</td>
                                                <td>
                                                    <span
                                                        className={
                                                            isActive ? styles.statusActive : styles.statusInactive
                                                        }
                                                    >
                                                        {item["Trạng thái MST"]}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
