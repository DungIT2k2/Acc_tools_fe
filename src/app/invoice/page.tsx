"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../styles/invoice.module.css";
import apiTax from "@/src/lib/axiosCapcha";
import callApi from "@/src/lib/axios";
import { decodeTokenPayload } from "@/src/lib/jwt";
import { DynamicTable, type DynamicTableColumn } from "@/src/components/DynamicTable";
import { useRouter } from "next/navigation";

type InvoiceRow = {
    stt: number;
    khmshdon: number;
    khhdon: string;
    shdon: number;
    tdlap: string;
    nbmst: string;
    nbten: string;
    tgtcthue: number;
    tgtthue: number;
    ttcktmai: number | null;
    tgtphi: number | null;
    tgtttbso: number;
    tthai: string;
};

type InvoiceSectionError = {
    error: string;
};

type InvoiceSectionData = InvoiceRow[] | InvoiceSectionError[];

type PurchaseInvoiceResponse = {
    invoiceIssuedData: InvoiceSectionData;
    invoiceNoCodeData: InvoiceSectionData;
    invoiceCashRegisterData: InvoiceSectionData;
};

function resolveSectionTable(
    data: InvoiceSectionData | undefined,
    defaultEmptyText: string,
) {
    if (Array.isArray(data)) {
        if (
            data.length > 0 &&
            data.every(
                (item) =>
                    typeof item === "object" &&
                    item !== null &&
                    "error" in item &&
                    typeof (item as { error?: unknown }).error === "string",
            )
        ) {
            return {
                rows: [],
                emptyText: (data[0] as InvoiceSectionError).error,
                count: 0,
            };
        }

        return {
            rows: data as InvoiceRow[],
            emptyText: defaultEmptyText,
            count: data.length,
        };
    }

    return {
        rows: [],
        emptyText: defaultEmptyText,
        count: 0,
    };
}

function formatHeaderLabel(label: string) {
    const words = label.split(" ");
    const lines: string[] = [];

    for (let index = 0; index < words.length; index += 2) {
        lines.push(words.slice(index, index + 2).join(" "));
    }

    return (
        <span className={styles.headerLabel}>
            {lines.map((line, index) => (
                <span key={`${label}-${index}`}>
                    {line}
                </span>
            ))}
        </span>
    );
}

const PURCHASE_INVOICE_COLUMNS: DynamicTableColumn<InvoiceRow>[] = [
    { header: formatHeaderLabel("STT"), field: "stt" },
    { header: formatHeaderLabel("Ký hiệu mẫu số"), field: "khmshdon" },
    { header: formatHeaderLabel("Ký hiệu hóa đơn"), field: "khhdon" },
    { header: formatHeaderLabel("Số hoá đơn"), field: "shdon" },
    {
        header: formatHeaderLabel("Ngày lập"),
        field: "tdlap",
        render: (value) => {
            if (typeof value !== "string" || !value) {
                return "-";
            }

            return value;
        },
    },
    { header: formatHeaderLabel("MST người bán"), field: "nbmst" },
    { header: formatHeaderLabel("Tên người bán"), field: "nbten" },
    {
        header: formatHeaderLabel("Tổng tiền trước thuế"),
        field: "tgtcthue",
        render: (value) => new Intl.NumberFormat("vi-VN").format(Number(value ?? 0)),
    },
    {
        header: formatHeaderLabel("Tổng tiền thuế"),
        field: "tgtthue",
        render: (value) => new Intl.NumberFormat("vi-VN").format(Number(value ?? 0)),
    },
    {
        header: formatHeaderLabel("Tổng tiền chiết khấu thương mại"),
        field: "ttcktmai",
        render: (value) => new Intl.NumberFormat("vi-VN").format(Number(value ?? 0)),
    },
    {
        header: formatHeaderLabel("Tổng tiền Phí"),
        field: "tgtphi",
        render: (value) => (value == null ? "" : new Intl.NumberFormat("vi-VN").format(Number(value))),
    },
    {
        header: formatHeaderLabel("Tổng tiền thanh toán"),
        field: "tgtttbso",
        render: (value) => new Intl.NumberFormat("vi-VN").format(Number(value ?? 0)),
    },
    { header: formatHeaderLabel("Trạng thái hoá đơn"), field: "tthai" },
];

function formatDateForApi(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getInitialDateRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
        from: formatDateForInput(start),
        to: formatDateForInput(end),
    };
}

function getLastDateOfMonth(value: string) {
    const [year, month] = value.split("-").map(Number);
    return formatDateForInput(new Date(year, month, 0));
}

export default function InvoicePage() {
    const initialDates = getInitialDateRange();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [captchaSvg, setCaptchaSvg] = useState("");
    const [captchaKey, setCaptchaKey] = useState("");
    const [usernameInvoice, setUsernameInvoice] = useState("");
    const [selectedFeature, setSelectedFeature] = useState(1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [purchaseFromDate, setPurchaseFromDate] = useState(initialDates.from);
    const [purchaseToDate, setPurchaseToDate] = useState(initialDates.to);
    const [purchaseSize, setPurchaseSize] = useState("50");
    const [purchaseData, setPurchaseData] = useState<PurchaseInvoiceResponse | null>(null);
    const [purchaseError, setPurchaseError] = useState("");
    const [isSearchingPurchase, setIsSearchingPurchase] = useState(false);
    const [isExportingPurchase, setIsExportingPurchase] = useState(false);
    const [collapsedTables, setCollapsedTables] = useState({
        issued: false,
        noCode: false,
        cashRegister: false,
    });
    const router = useRouter();

    const loadCaptcha = useCallback(async () => {
        try {
            const res = await apiTax.get("/captcha");
            setCaptchaSvg(res.data.content);
            setCaptchaKey(res.data.key);
        } catch (err) {
            console.error("Load captcha error", err);
        }
    }, []);

    useEffect(() => {
        loadCaptcha();
    }, [loadCaptcha]);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            return;
        }

        const payload = decodeTokenPayload<{ usernameInvoice?: string; fullName?: string }>(token);
        if (payload?.usernameInvoice && payload?.fullName) {
            setUsernameInvoice(`${payload.usernameInvoice} - ${payload.fullName}`);
            return;
        }

    }, []);

    useEffect(() => {
        const intervalId = setInterval(() => {
            loadCaptcha();
            setCaptcha("");
        }, 120000);

        return () => clearInterval(intervalId);
    }, [loadCaptcha]);

    const handleLogin = async () => {
        if (!username || !password || !captcha) {
            alert("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        try {
            setIsLoading(true);
            const res = await callApi.post("/module/loginInvoice", {
                username,
                password,
                cvalue: captcha,
                ckey: captchaKey,
            });

            const token = res.data.access_token as string;
            const payload = decodeTokenPayload<{ usernameInvoice?: string; fullName?: string }>(token);

            if (!payload?.usernameInvoice || !payload?.fullName) {
                alert("Token không hợp lệ cho đăng nhập hoá đơn điện tử");
                return;
            }

            localStorage.setItem("access_token", token);
            setUsernameInvoice(`${payload.usernameInvoice} - ${payload.fullName}`);
            setCaptcha("");
            setPurchaseError("");
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Đăng nhập thất bại";
            alert(message);

            loadCaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToMenu = () => {
        router.push("/menu");
    };

    const handleSelectFeature = (feature: number) => {
        setSelectedFeature(feature);
        setIsSidebarOpen(false);
    };

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            const res = await callApi.post("/module/logoutInvoice");

            localStorage.setItem("access_token", res.data.access_token);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Đăng xuất thất bại";
            alert(message);
        } finally {
            setUsernameInvoice("");
            setUsername("");
            setPassword("");
            setCaptcha("");
            setPurchaseData(null);
            setPurchaseError("");
            loadCaptcha();
            setSelectedFeature(1);
            setIsLoggingOut(false);
        }
    };

    const handleSearchPurchaseInvoices = async () => {
        if (!purchaseFromDate || !purchaseToDate) {
            setPurchaseError("Vui lòng chọn đầy đủ khoảng thời gian.");
            return;
        }

        const fromDate = new Date(purchaseFromDate);
        const toDate = new Date(purchaseToDate);

        if (fromDate > toDate) {
            setPurchaseError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }

        const diffInDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays > 31) {
            setPurchaseError("Khoảng thời gian tối đa là 1 tháng.");
            return;
        }

        try {
            setIsSearchingPurchase(true);
            setPurchaseError("");

            const res = await callApi.get<PurchaseInvoiceResponse>("/module/getPurchaseInvoice", {
                params: {
                    from: formatDateForApi(purchaseFromDate),
                    to: formatDateForApi(purchaseToDate),
                    size: purchaseSize,
                },
            });

            setPurchaseData({
                invoiceIssuedData: res.data.invoiceIssuedData ?? [],
                invoiceNoCodeData: res.data.invoiceNoCodeData ?? [],
                invoiceCashRegisterData: res.data.invoiceCashRegisterData ?? [],
            });
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Không lấy được dữ liệu hoá đơn mua";
            setPurchaseError(message);
            setPurchaseData(null);
        } finally {
            setIsSearchingPurchase(false);
        }
    };

    const handleExportPurchaseInvoices = async () => {
        if (!purchaseFromDate || !purchaseToDate) {
            setPurchaseError("Vui lòng chọn đầy đủ khoảng thời gian.");
            return;
        }

        const fromDate = new Date(purchaseFromDate);
        const toDate = new Date(purchaseToDate);

        if (fromDate > toDate) {
            setPurchaseError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }

        const diffInDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays > 31) {
            setPurchaseError("Khoảng thời gian tối đa là 1 tháng.");
            return;
        }

        try {
            setIsExportingPurchase(true);
            setPurchaseError("");

            const res = await callApi.get<Blob>("/module/exportPurchaseInvoice", {
                params: {
                    from: formatDateForApi(purchaseFromDate),
                    to: formatDateForApi(purchaseToDate),
                    size: purchaseSize,
                },
                responseType: "blob",
            });

            const contentDisposition = res.headers["content-disposition"] as string | undefined;
            const filenameMatch = contentDisposition?.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
            const decodedFilename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].replace(/"/g, "")) : "hoa-don-mua.xlsx";

            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = decodedFilename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Xuất file thất bại";
            setPurchaseError(message);
        } finally {
            setIsExportingPurchase(false);
        }
    };

    const isLoggedIn = Boolean(usernameInvoice);

    const handlePurchaseFromDateChange = (value: string) => {
        setPurchaseFromDate(value);

        const selectedDate = new Date(value);
        if (selectedDate.getDate() === 1) {
            setPurchaseToDate(getLastDateOfMonth(value));
        }
    };

    const toggleTableSection = (section: "issued" | "noCode" | "cashRegister") => {
        setCollapsedTables((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const renderFeatureContent = () => {
        if (selectedFeature === 1) {
            const issuedTable = resolveSectionTable(
                purchaseData?.invoiceIssuedData,
                "Chưa có dữ liệu hoá đơn này",
            );
            const noCodeTable = resolveSectionTable(
                purchaseData?.invoiceNoCodeData,
                "Chưa có dữ liệu hoá đơn này",
            );
            const cashRegisterTable = resolveSectionTable(
                purchaseData?.invoiceCashRegisterData,
                "Chưa có dữ liệu hoá đơn này",
            );

            return (
                <div className={styles.featureContent}>
                    <div className={styles.filterPanel}>
                        <div className={styles.filterGrid}>
                            <div className={styles.field}>
                                <label>Từ ngày</label>
                                <input
                                    type="date"
                                    value={purchaseFromDate}
                                    onChange={(e) => handlePurchaseFromDateChange(e.target.value)}
                                />
                            </div>

                            <div className={styles.field}>
                                <label>Đến ngày</label>
                                <input
                                    type="date"
                                    value={purchaseToDate}
                                    onChange={(e) => setPurchaseToDate(e.target.value)}
                                />
                            </div>

                            <div className={styles.field}>
                                <label>Size</label>
                                <select
                                    className={styles.selectField}
                                    value={purchaseSize}
                                    onChange={(e) => setPurchaseSize(e.target.value)}
                                >
                                    <option value="15">15</option>
                                    <option value="30">30</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.filterActions}>
                            <button className={styles.loginButton} onClick={handleSearchPurchaseInvoices}>
                                {isSearchingPurchase ? "Đang tìm kiếm..." : "Tìm kiếm"}
                            </button>
                            <button className={styles.exportButton} onClick={handleExportPurchaseInvoices}>
                                {isExportingPurchase ? "Đang xuất file..." : "Xuất Excel"}
                            </button>
                            <span className={styles.helperText}>Khoảng thời gian tra cứu tối đa 1 tháng.</span>
                        </div>
                    </div>

                    {purchaseError ? <div className={styles.errorMessage}>{purchaseError}</div> : null}

                    <div className={styles.tableSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionHeaderLeft}>
                                <button
                                    className={`${styles.collapseButton} ${collapsedTables.issued ? styles.collapseButtonCollapsed : ""}`}
                                    onClick={() => toggleTableSection("issued")}
                                >
                                    <span>&gt;</span>
                                </button>
                                <h3>Đã cấp mã hoá đơn</h3>
                            </div>
                            <span>{issuedTable.count} dòng</span>
                        </div>
                        {!collapsedTables.issued ? (
                            <div className={styles.tableWrapper}>
                                <DynamicTable
                                    columns={PURCHASE_INVOICE_COLUMNS}
                                    data={issuedTable.rows}
                                    emptyText={issuedTable.emptyText}
                                    tableClassName={styles.dataTable}
                                    headClassName={styles.tableHeadCell}
                                    cellClassName={styles.tableCell}
                                    emptyClassName={styles.emptyState}
                                />
                            </div>
                        ) : null}
                    </div>

                    <div className={styles.tableSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionHeaderLeft}>
                                <button
                                    className={`${styles.collapseButton} ${collapsedTables.noCode ? styles.collapseButtonCollapsed : ""}`}
                                    onClick={() => toggleTableSection("noCode")}
                                >
                                    <span>&gt;</span>
                                </button>
                                <h3>Cục Thuế đã nhận không mã</h3>
                            </div>
                            <span>{noCodeTable.count} dòng</span>
                        </div>
                        {!collapsedTables.noCode ? (
                            <div className={styles.tableWrapper}>
                                <DynamicTable
                                    columns={PURCHASE_INVOICE_COLUMNS}
                                    data={noCodeTable.rows}
                                    emptyText={noCodeTable.emptyText}
                                    tableClassName={styles.dataTable}
                                    headClassName={styles.tableHeadCell}
                                    cellClassName={styles.tableCell}
                                    emptyClassName={styles.emptyState}
                                />
                            </div>
                        ) : null}
                    </div>

                    <div className={styles.tableSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionHeaderLeft}>
                                <button
                                    className={`${styles.collapseButton} ${collapsedTables.cashRegister ? styles.collapseButtonCollapsed : ""}`}
                                    onClick={() => toggleTableSection("cashRegister")}
                                >
                                    <span>&gt;</span>
                                </button>
                                <h3>Cục Thuế đã nhận hoá đơn có mã khởi tạo từ máy tính tiền </h3>
                            </div>
                            <span>{cashRegisterTable.count} dòng</span>
                        </div>
                        {!collapsedTables.cashRegister ? (
                            <div className={styles.tableWrapper}>
                                <DynamicTable
                                    columns={PURCHASE_INVOICE_COLUMNS}
                                    data={cashRegisterTable.rows}
                                    emptyText={cashRegisterTable.emptyText}
                                    tableClassName={styles.dataTable}
                                    headClassName={styles.tableHeadCell}
                                    cellClassName={styles.tableCell}
                                    emptyClassName={styles.emptyState}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        }

        if (selectedFeature === 2) {
            return "Nội dung review dữ liệu của chức năng 2 sẽ hiển thị tại đây.";
        }

        if (selectedFeature === 3) {
            return "Nội dung review dữ liệu của chức năng 3 sẽ hiển thị tại đây.";
        }

        return "Nội dung review dữ liệu của chức năng 4 sẽ hiển thị tại đây.";
    };

    return (
        <div className={styles.page}>
            {!isLoggedIn ? (
                <div className={styles.loginWrapper}>
                    <div className={styles.loginCard}>
                        <h1 className={styles.loginTitle}>Đăng nhập HĐĐT</h1>

                        <div className={styles.field}>
                            <label>Tài khoản</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className={styles.field}>
                            <label>Mật khẩu</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className={styles.field}>
                            <label>Captcha</label>
                            <div
                                className={styles.captchaBox}
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

                        <button className={styles.loginButton} onClick={handleLogin}>
                            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                        </button>
                        <button className={styles.secondaryButton} onClick={handleBackToMenu}>
                            Về menu
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles.dashboard}>
                    <aside className={`${styles.leftPanel} ${isSidebarOpen ? styles.leftPanelOpen : ""}`}>
                        <div className={styles.userInfo}>
                            <p><strong>Tài khoản:</strong> {usernameInvoice}</p>
                            <button className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
                                {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                            </button>
                        </div>

                        <div className={styles.menuList}>
                            {[1, 2, 3, 4].map((feature) => (
                                <button
                                    key={feature}
                                    className={`${styles.menuButton} ${selectedFeature === feature ? styles.menuButtonActive : ""}`}
                                    onClick={() => handleSelectFeature(feature)}
                                >
                                    {feature === 1 ? "Lấy hoá đơn mua" : `Chức năng ${feature}`}
                                </button>
                            ))}
                        </div>

                    </aside>

                    {isSidebarOpen ? <button className={styles.sidebarBackdrop} onClick={() => setIsSidebarOpen(false)} /> : null}

                    <section className={styles.rightPanel}>
                        <div className={styles.contentToolbar}>
                            <button className={styles.menuToggleButton} onClick={() => setIsSidebarOpen((prev) => !prev)}>
                                {isSidebarOpen ? "Đóng menu" : "Mở menu chức năng"}
                            </button>
                        </div>
                        <h2>{selectedFeature === 1 ? "Lấy hoá đơn mua" : "Review dữ liệu"}</h2>
                        <div className={styles.previewBox}>
                            <p><strong>Đang chọn:</strong> {selectedFeature === 1 ? "Lấy hoá đơn mua" : `Chức năng ${selectedFeature}`}</p>
                            <div>{renderFeatureContent()}</div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}