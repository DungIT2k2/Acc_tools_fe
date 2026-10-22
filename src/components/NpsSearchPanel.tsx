"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/npsLookup.module.css";
import callApi, { getErrorMessageAsync, isNpsSessionExpiredError } from "@/src/lib/axios";
import Tesseract from "tesseract.js";

type SearchCaptchaResponse = {
    image: string;
    contentType: string;
};

type HoSoItem = {
    stt: number;
    maHoSo: string;
    maTTHC: string | null;
    tenTTHC: string;
    toKhai: string;
    kyTinhThue: string;
    loaiToKhai: string;
    lanNopBoSung: number;
    lanNop: number;
    coQuanThue: string;
    ngayNop: string;
    trangThai: string;
    coTheNopBoSung: boolean;
    maToKhai: string | null;
    mstNop: string | null;
    mstNopThay: string | null;
    mstDaiLyThue: string | null;
    maCqt: string | null;
    maTrangThai: string | null;
};

type SearchResponse = {
    currentPage: number;
    totalPage: number;
    totalRecords: number;
    items: HoSoItem[];
};

type FieldErrors = {
    date?: string;
    captcha?: string;
};

const TAX_SYSTEM_BUSY = "Hệ thống thuế đang bận, thử lại sau.";

// Giá trị cho <input type="date"> theo giờ máy người dùng
function toInputDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// yyyy-MM-dd -> dd/MM/yyyy theo định dạng backend yêu cầu
function toApiDate(value: string): string {
    const [yyyy, mm, dd] = value.split("-");
    return `${dd}/${mm}/${yyyy}`;
}

function getStatusClass(item: HoSoItem): string {
    const status = item.trangThai?.toLowerCase() ?? "";
    if (status.includes("không") || status.includes("từ chối") || status.includes("lỗi")) {
        return styles.badgeDanger;
    }
    if (item.maTrangThai === "006" || status.includes("chấp nhận") || status.includes("thành công")) {
        return styles.badgeSuccess;
    }
    return styles.badgePending;
}

function getStatus(err: unknown): number | undefined {
    return (err as { response?: { status?: number } })?.response?.status;
}

type NpsSearchPanelProps = {
    username: string;
    onSessionExpired: (message: string) => void;
};

export default function NpsSearchPanel({ username, onSessionExpired }: NpsSearchPanelProps) {
    const [tuNgay, setTuNgay] = useState(() => {
        const today = new Date();
        return toInputDate(new Date(today.getFullYear(), today.getMonth(), 1));
    });
    const [denNgay, setDenNgay] = useState(() => toInputDate(new Date()));
    const [maHoSo, setMaHoSo] = useState("");
    const [maTTHC, setMaTTHC] = useState("");
    const [maToKhai, setMaToKhai] = useState("");
    const [maNghiepVu, setMaNghiepVu] = useState("");
    const [mstUyQuyen, setMstUyQuyen] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [captchaImageUrl, setCaptchaImageUrl] = useState<string | null>(null);
    const [captchaValue, setCaptchaValue] = useState("");
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [result, setResult] = useState<SearchResponse | null>(null);
    const captchaRequestRef = useRef<Promise<void> | null>(null);

    const loadCaptcha = useCallback(async () => {
        if (captchaRequestRef.current) {
            return captchaRequestRef.current;
        }

        setLoadingCaptcha(true);

        const request = (async () => {
            try {
                const res = await callApi.get("/nps/searchCaptcha", { params: { username } });
                const { image, contentType } = res.data as SearchCaptchaResponse;
                // contentType có kèm ";charset=UTF-8" nên chỉ lấy phần kiểu ảnh
                const mimeType = contentType?.split(";")[0]?.trim() || "image/png";
                const url = `data:${mimeType};base64,${image}`;
                setCaptchaImageUrl(url);

                try {
                    const { data: { text } } = await Tesseract.recognize(url, "eng");
                    setCaptchaValue(text.replace(/\s+/g, ""));
                } catch {
                    setCaptchaValue("");
                }
            } catch (err) {
                setCaptchaImageUrl(null);
                const message = await getErrorMessageAsync(err, "Không thể tải mã captcha.");
                if (isNpsSessionExpiredError(err)) {
                    onSessionExpired(message);
                    return;
                }
                setError(getStatus(err) === 502 ? TAX_SYSTEM_BUSY : message);
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
    }, [username, onSessionExpired]);

    useEffect(() => {
        loadCaptcha();
    }, [loadCaptcha]);

    const handleSearch = async () => {
        if (loadingSearch) {
            return;
        }
        if (loadingCaptcha || captchaRequestRef.current) {
            setError("Vui lòng chờ captcha tải xong trước khi tra cứu.");
            return;
        }

        const nextFieldErrors: FieldErrors = {};
        if (!tuNgay || !denNgay) {
            nextFieldErrors.date = "Vui lòng chọn đầy đủ từ ngày và đến ngày.";
        } else if (tuNgay > denNgay) {
            nextFieldErrors.date = "Từ ngày không được lớn hơn đến ngày.";
        }
        if (!captchaValue.trim()) {
            nextFieldErrors.captcha = "Vui lòng nhập mã captcha.";
        }
        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) {
            setError(null);
            return;
        }

        const optionalParams = { maHoSo, maTTHC, maToKhai, maNghiepVu, mstUyQuyen };
        const params: Record<string, string> = {
            username,
            captcha: captchaValue.trim(),
            tuNgay: toApiDate(tuNgay),
            denNgay: toApiDate(denNgay),
        };
        for (const [key, value] of Object.entries(optionalParams)) {
            if (value.trim()) {
                params[key] = value.trim();
            }
        }

        setLoadingSearch(true);
        setError(null);
        setResult(null);

        try {
            const res = await callApi.get("/nps/searchHoSo", { params });
            const data = res.data as SearchResponse;
            setResult({ ...data, items: Array.isArray(data?.items) ? data.items : [] });
        } catch (err) {
            const message = await getErrorMessageAsync(err, "Tra cứu hồ sơ thất bại. Vui lòng thử lại.");
            const status = getStatus(err);

            if (isNpsSessionExpiredError(err)) {
                setLoadingSearch(false);
                onSessionExpired(message);
                return;
            }
            if (status === 502) {
                setError(TAX_SYSTEM_BUSY);
            } else if (status === 400 && message.toLowerCase().includes("captcha")) {
                setFieldErrors({ captcha: message });
            } else if (status === 400 && message.includes("tuNgay")) {
                setFieldErrors({ date: message });
            } else if (status !== 401) {
                setError(message);
            }
        }

        // Captcha chỉ dùng được một lần, kể cả khi tra cứu lỗi
        setLoadingSearch(false);
        setCaptchaValue("");
        loadCaptcha();
    };

    const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            void handleSearch();
        }
    };

    return (
        <>
            <div className={styles.filterGrid}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="nps-tu-ngay">Từ ngày</label>
                    <input
                        id="nps-tu-ngay"
                        className={`${styles.input} ${fieldErrors.date ? styles.inputError : ""}`}
                        type="date"
                        value={tuNgay}
                        max={denNgay || undefined}
                        onChange={(e) => {
                            setTuNgay(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="nps-den-ngay">Đến ngày</label>
                    <input
                        id="nps-den-ngay"
                        className={`${styles.input} ${fieldErrors.date ? styles.inputError : ""}`}
                        type="date"
                        value={denNgay}
                        min={tuNgay || undefined}
                        onChange={(e) => {
                            setDenNgay(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                    />
                </div>
                <div className={`${styles.field} ${styles.filterSpan2}`}>
                    <label className={styles.label} htmlFor="nps-ma-ho-so">Mã hồ sơ</label>
                    <input
                        id="nps-ma-ho-so"
                        className={styles.input}
                        type="text"
                        placeholder="VD: G12.18-261021-00219700"
                        value={maHoSo}
                        onChange={(e) => setMaHoSo(e.target.value)}
                        onKeyDown={onEnter}
                    />
                </div>
            </div>
            {fieldErrors.date && <p className={styles.fieldError}>{fieldErrors.date}</p>}

            <button
                type="button"
                className={styles.advancedToggle}
                onClick={() => setShowAdvanced((prev) => !prev)}
                aria-expanded={showAdvanced}
            >
                {showAdvanced ? "▾" : "▸"} Điều kiện nâng cao
            </button>

            {showAdvanced && (
                <div className={styles.filterGrid}>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="nps-ma-tthc">Mã thủ tục hành chính</label>
                        <input
                            id="nps-ma-tthc"
                            className={styles.input}
                            type="text"
                            placeholder="VD: 1.007014"
                            value={maTTHC}
                            onChange={(e) => setMaTTHC(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="nps-ma-to-khai">Mã tờ khai</label>
                        <input
                            id="nps-ma-to-khai"
                            className={styles.input}
                            type="text"
                            placeholder="VD: 842"
                            value={maToKhai}
                            onChange={(e) => setMaToKhai(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="nps-ma-nghiep-vu">Mã nghiệp vụ</label>
                        <input
                            id="nps-ma-nghiep-vu"
                            className={styles.input}
                            type="text"
                            placeholder="Nhập mã nghiệp vụ"
                            value={maNghiepVu}
                            onChange={(e) => setMaNghiepVu(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="nps-mst-uy-quyen">MST được uỷ quyền</label>
                        <input
                            id="nps-mst-uy-quyen"
                            className={styles.input}
                            type="text"
                            placeholder="Dùng khi tra cứu hộ"
                            value={mstUyQuyen}
                            onChange={(e) => setMstUyQuyen(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </div>
                </div>
            )}

            <div className={styles.searchActionRow}>
                <div className={styles.searchCaptchaField}>
                    <label className={styles.label} htmlFor="nps-search-captcha">Mã captcha</label>
                    <div className={styles.captchaRow}>
                        <div
                            className={`${styles.captchaImageBox} ${fieldErrors.captcha ? styles.inputError : ""}`}
                            onClick={() => loadCaptcha()}
                            title="Nhấn để đổi mã"
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
                            id="nps-search-captcha"
                            className={`${styles.input} ${fieldErrors.captcha ? styles.inputError : ""}`}
                            type="text"
                            placeholder="Nhập captcha"
                            autoComplete="off"
                            value={captchaValue}
                            onChange={(e) => {
                                setCaptchaValue(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, captcha: undefined }));
                            }}
                            onKeyDown={onEnter}
                        />
                        <button
                            className={styles.changeCaptchaBtn}
                            onClick={() => loadCaptcha()}
                            disabled={loadingCaptcha}
                            type="button"
                        >
                            <span className={loadingCaptcha ? styles.refreshBtnSpinning : ""}>↻</span> Đổi mã
                        </button>
                    </div>
                    {fieldErrors.captcha && <p className={styles.fieldError}>{fieldErrors.captcha}</p>}
                </div>

                <button
                    className={`${styles.submitBtn} ${styles.searchBtn}`}
                    onClick={handleSearch}
                    disabled={loadingSearch || loadingCaptcha}
                >
                    {loadingSearch && <span className={styles.spinner} />}
                    {loadingSearch ? "Đang tra cứu..." : "Tra cứu"}
                </button>
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            {result && (
                <div className={styles.resultBox}>
                    <div className={styles.resultHeader}>Kết quả tra cứu ({result.totalRecords} hồ sơ)</div>
                    {result.totalPage > 1 && (
                        <p className={styles.warningMsg}>
                            Chỉ hiển thị {result.items.length} hồ sơ đầu, thu hẹp khoảng ngày để xem thêm.
                        </p>
                    )}
                    {result.items.length === 0 ? (
                        <p className={styles.emptyState}>Không tìm thấy hồ sơ nào phù hợp.</p>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.resultTable}>
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã hồ sơ</th>
                                        <th>Tên TTHC</th>
                                        <th>Tờ khai</th>
                                        <th>Kỳ tính thuế</th>
                                        <th>Loại tờ khai</th>
                                        <th>Lần nộp bổ sung</th>
                                        <th>Lần nộp</th>
                                        <th>Cơ quan thuế tiếp nhận</th>
                                        <th>Ngày nộp</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.items.map((item) => (
                                        <tr key={`${item.stt}-${item.maHoSo}`}>
                                            <td className={styles.cellCenter}>{item.stt}</td>
                                            <td className={styles.cellNowrap}>{item.maHoSo}</td>
                                            <td className={styles.cellWide}>{item.tenTTHC}</td>
                                            <td className={styles.cellWide}>{item.toKhai}</td>
                                            <td className={styles.cellNowrap}>{item.kyTinhThue}</td>
                                            <td className={styles.cellNowrap}>{item.loaiToKhai}</td>
                                            <td className={styles.cellCenter}>{item.lanNopBoSung ?? "-"}</td>
                                            <td className={styles.cellCenter}>{item.lanNop ?? "-"}</td>
                                            <td className={styles.cellWide}>{item.coQuanThue}</td>
                                            <td className={styles.cellNowrap}>{item.ngayNop}</td>
                                            <td className={styles.cellNowrap}>
                                                <span className={`${styles.badge} ${getStatusClass(item)}`}>
                                                    {item.trangThai || "-"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
