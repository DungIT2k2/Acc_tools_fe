"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

type RecentLoggedInvoiceAccount = {
    key: string;
    value: string;
};

type ComparePurchaseContext = {
    file: File;
    from: string;
    to: string;
};

type CompareErrorItem = {
    row: number;
    description: string;
};

type CompareResultData = {
    myErrorArr: CompareErrorItem[];
    taxErrorArr: CompareErrorItem[];
};

const PURCHASE_INVOICE_SECTION_ERROR_TEXT = "Có lỗi xảy ra khi lấy hoá đơn";

function isInvoiceSectionError(item: unknown): item is InvoiceSectionError {
    return typeof item === "object" && item !== null && "error" in item && typeof (item as { error?: unknown }).error === "string";
}

function createInvoiceSectionError(): InvoiceSectionError[] {
    return [{ error: PURCHASE_INVOICE_SECTION_ERROR_TEXT }];
}

function normalizeInvoiceSectionData(data: unknown): InvoiceSectionData {
    if (Array.isArray(data)) {
        if (data.some((item) => isInvoiceSectionError(item))) {
            return createInvoiceSectionError();
        }

        return data as InvoiceRow[];
    }

    if (isInvoiceSectionError(data)) {
        return createInvoiceSectionError();
    }

    return [];
}

function normalizePurchaseInvoiceResponse(data: unknown): PurchaseInvoiceResponse {
    if (Array.isArray(data) && data.some((item) => isInvoiceSectionError(item))) {
        const errorSection = createInvoiceSectionError();

        return {
            invoiceIssuedData: errorSection,
            invoiceNoCodeData: errorSection,
            invoiceCashRegisterData: errorSection,
        };
    }

    if (typeof data !== "object" || data === null) {
        return {
            invoiceIssuedData: [],
            invoiceNoCodeData: [],
            invoiceCashRegisterData: [],
        };
    }

    const response = data as {
        invoiceIssuedData?: unknown;
        invoiceNoCodeData?: unknown;
        invoiceCashRegisterData?: unknown;
    };

    return {
        invoiceIssuedData: normalizeInvoiceSectionData(response.invoiceIssuedData),
        invoiceNoCodeData: normalizeInvoiceSectionData(response.invoiceNoCodeData),
        invoiceCashRegisterData: normalizeInvoiceSectionData(response.invoiceCashRegisterData),
    };
}

function resolveSectionTable(
    data: InvoiceSectionData | InvoiceSectionError | undefined,
    defaultEmptyText: string,
) {
    if (isInvoiceSectionError(data)) {
        return {
            rows: [],
            emptyText: PURCHASE_INVOICE_SECTION_ERROR_TEXT,
            count: 0,
        };
    }

    if (Array.isArray(data)) {
        if (
            data.length > 0 &&
            data.every(
                (item) => isInvoiceSectionError(item),
            )
        ) {
            return {
                rows: [],
                emptyText: PURCHASE_INVOICE_SECTION_ERROR_TEXT,
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

function formatDateForApi(date: Date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function parseInputDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
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

function getStartOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toStartOfMonthInputValue(value: string) {
    return formatDateForInput(getStartOfMonth(parseInputDate(value)));
}

function toEndOfMonthInputValue(value: string) {
    return formatDateForInput(getEndOfMonth(parseInputDate(value)));
}

function getInclusiveMonthCount(startDate: Date, endDate: Date) {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
}

function buildPurchaseInvoiceMonthParams(fromValue: string, toValue: string) {
    const startDate = getStartOfMonth(parseInputDate(fromValue));
    const endDate = getStartOfMonth(parseInputDate(toValue));
    const monthCount = getInclusiveMonthCount(startDate, endDate);

    const fromDates: string[] = [];
    const toDates: string[] = [];

    for (let index = monthCount - 1; index >= 0; index -= 1) {
        const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
        fromDates.push(formatDateForApi(getStartOfMonth(currentMonth)));
        toDates.push(formatDateForApi(getEndOfMonth(currentMonth)));
    }

    return {
        from: fromDates.join(","),
        to: toDates.join(","),
    };
}

function normalizeRecentLoggedInvoiceAccounts(data: unknown): RecentLoggedInvoiceAccount[] {
    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map((item) => {
            if (typeof item === "string") {
                const key = item.trim();
                if (!key) {
                    return null;
                }

                return {
                    key,
                    value: "",
                };
            }

            if (typeof item !== "object" || item === null) {
                return null;
            }

            const key = String((item as { key?: unknown }).key ?? "").trim();
            const value = String((item as { value?: unknown }).value ?? "").trim();

            if (!key) {
                return null;
            }

            return {
                key,
                value,
            };
        })
        .filter((item): item is RecentLoggedInvoiceAccount => item !== null);
}

export default function InvoicePage() {
    const initialDates = getInitialDateRange();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [captchaSvg, setCaptchaSvg] = useState("");
    const [captchaKey, setCaptchaKey] = useState("");
    const [recentAccounts, setRecentAccounts] = useState<RecentLoggedInvoiceAccount[]>([]);
    const [selectedRecentUsername, setSelectedRecentUsername] = useState("");
    const [usernameInvoice, setUsernameInvoice] = useState("");
    const [isAuthResolved, setIsAuthResolved] = useState(false);
    const [selectedFeature, setSelectedFeature] = useState(1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isQuickLoggingIn, setIsQuickLoggingIn] = useState(false);
    const [isLoadingRecentUsers, setIsLoadingRecentUsers] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [purchaseFromDate, setPurchaseFromDate] = useState(initialDates.from);
    const [purchaseToDate, setPurchaseToDate] = useState(initialDates.to);
    const [purchaseData, setPurchaseData] = useState<PurchaseInvoiceResponse | null>(null);
    const [purchaseError, setPurchaseError] = useState("");
    const [isSearchingPurchase, setIsSearchingPurchase] = useState(false);
    const [isExportingPurchase, setIsExportingPurchase] = useState(false);
    const [isComparingPurchase, setIsComparingPurchase] = useState(false);
    const [comparePurchaseContext, setComparePurchaseContext] = useState<ComparePurchaseContext | null>(null);
    const [compareResultData, setCompareResultData] = useState<CompareResultData | null>(null);
    const [collapsedTables, setCollapsedTables] = useState({
        issued: false,
        noCode: false,
        cashRegister: false,
    });
    const compareFileInputRef = useRef<HTMLInputElement | null>(null);
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

    const loadRecentLoggedInvoiceUsers = useCallback(async () => {
        try {
            setIsLoadingRecentUsers(true);
            const res = await callApi.get<unknown>("/module/listLoggedInvoice");
            const recentUsers = normalizeRecentLoggedInvoiceAccounts(res.data);

            setRecentAccounts(recentUsers);
            setSelectedRecentUsername((prev) => {
                if (prev && recentUsers.some((item) => item.key === prev)) {
                    return prev;
                }

                return recentUsers[0]?.key ?? "";
            });
        } catch (err) {
            console.error("Load recent logged invoice users error", err);
            setRecentAccounts([]);
            setSelectedRecentUsername("");
        } finally {
            setIsLoadingRecentUsers(false);
        }
    }, []);

    const applyInvoiceLoginToken = useCallback((token: string) => {
        const payload = decodeTokenPayload<{ usernameInvoice?: string; fullName?: string }>(token);

        if (!payload?.usernameInvoice || !payload?.fullName) {
            alert("Token không hợp lệ cho đăng nhập hoá đơn điện tử");
            return false;
        }

        localStorage.setItem("access_token", token);
        setUsernameInvoice(`${payload.usernameInvoice} - ${payload.fullName}`);
        setCaptcha("");
        setPurchaseError("");
        return true;
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("access_token");

        if (token) {
            const payload = decodeTokenPayload<{ usernameInvoice?: string; fullName?: string }>(token);
            if (payload?.usernameInvoice && payload?.fullName) {
                setUsernameInvoice(`${payload.usernameInvoice} - ${payload.fullName}`);
            }
        }

        setIsAuthResolved(true);
    }, []);

    useEffect(() => {
        if (!isAuthResolved || usernameInvoice) {
            return;
        }

        loadCaptcha();
    }, [isAuthResolved, loadCaptcha, usernameInvoice]);

    useEffect(() => {
        if (!isAuthResolved || usernameInvoice) {
            return;
        }

        loadRecentLoggedInvoiceUsers();
    }, [isAuthResolved, loadRecentLoggedInvoiceUsers, usernameInvoice]);

    useEffect(() => {
        if (!isAuthResolved || usernameInvoice) {
            return;
        }

        const intervalId = setInterval(() => {
            loadCaptcha();
            setCaptcha("");
        }, 120000);

        return () => clearInterval(intervalId);
    }, [isAuthResolved, loadCaptcha, usernameInvoice]);

    const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleLogin();
    };

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

            if (applyInvoiceLoginToken(token)) {
                loadRecentLoggedInvoiceUsers();
            }
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

    const handleQuickLogin = async () => {
        if (!selectedRecentUsername) {
            alert("Vui lòng chọn tài khoản đăng nhập gần đây");
            return;
        }

        try {
            setIsQuickLoggingIn(true);
            const res = await callApi.post("/module/loginInvoice", {
                username: selectedRecentUsername,
            });

            const token = res.data.access_token as string;
            if (applyInvoiceLoginToken(token)) {
                loadRecentLoggedInvoiceUsers();
            }
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Đăng nhập nhanh thất bại";
            alert(message);
        } finally {
            setIsQuickLoggingIn(false);
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
            setSelectedRecentUsername("");
            setPurchaseData(null);
            setPurchaseError("");
            loadCaptcha();
            loadRecentLoggedInvoiceUsers();
            setSelectedFeature(1);
            setIsLoggingOut(false);
        }
    };

    const getValidatedPurchaseInvoiceParams = () => {
        if (!purchaseFromDate || !purchaseToDate) {
            setPurchaseError("Vui lòng chọn đầy đủ khoảng thời gian.");
            return null;
        }

        const fromDate = parseInputDate(purchaseFromDate);
        const toDate = parseInputDate(purchaseToDate);

        if (fromDate > toDate) {
            setPurchaseError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return null;
        }

        const monthCount = getInclusiveMonthCount(getStartOfMonth(fromDate), getStartOfMonth(toDate));
        if (monthCount > 12) {
            setPurchaseError("Khoảng thời gian tối đa là 12 tháng.");
            return null;
        }

        setPurchaseError("");
        return buildPurchaseInvoiceMonthParams(purchaseFromDate, purchaseToDate);
    };

    const handleSearchPurchaseInvoices = async () => {
        const params = getValidatedPurchaseInvoiceParams();
        if (!params) {
            return;
        }

        try {
            setIsSearchingPurchase(true);
            setPurchaseError("");

            const res = await callApi.get<unknown>("/module/getPurchaseInvoice", {
                params: {
                    from: params.from,
                    to: params.to,
                },
            });

            setPurchaseData(normalizePurchaseInvoiceResponse(res.data));
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
        const params = getValidatedPurchaseInvoiceParams();
        if (!params) {
            return;
        }

        try {
            setIsExportingPurchase(true);
            setPurchaseError("");

            const res = await callApi.get<Blob>("/module/exportPurchaseInvoice", {
                params: {
                    from: params.from,
                    to: params.to,
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

    const handleOpenCompareFilePicker = () => {
        compareFileInputRef.current?.click();
    };

    const handleComparePurchaseFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        event.target.value = "";

        if (!selectedFile) {
            return;
        }

        const params = getValidatedPurchaseInvoiceParams();
        if (!params) {
            return;
        }

        setComparePurchaseContext({
            file: selectedFile,
            from: params.from,
            to: params.to,
        });
    };

    const handleCancelComparePurchase = () => {
        if (isComparingPurchase) {
            return;
        }

        setComparePurchaseContext(null);
    };

    const handleCloseCompareResult = () => {
        setCompareResultData(null);
    };

    const handleConfirmComparePurchase = async () => {
        if (!comparePurchaseContext) {
            return;
        }

        try {
            setIsComparingPurchase(true);
            setPurchaseError("");

            const formData = new FormData();
            formData.append("File", comparePurchaseContext.file);
            formData.append("from", comparePurchaseContext.from);
            formData.append("to", comparePurchaseContext.to);

            const res = await callApi.post<unknown>("/module/comparePurchaseInvoice", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setCompareResultData(res.data as CompareResultData);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Đối xoát dữ liệu thất bại";
            setPurchaseError(message);
        } finally {
            setIsComparingPurchase(false);
            setComparePurchaseContext(null);
        }
    };

    const isLoggedIn = Boolean(usernameInvoice);

    const handlePurchaseFromDateChange = (value: string) => {
        setPurchaseFromDate(toStartOfMonthInputValue(value));
    };

    const handlePurchaseToDateChange = (value: string) => {
        setPurchaseToDate(toEndOfMonthInputValue(value));
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
                                    onChange={(e) => handlePurchaseToDateChange(e.target.value)}
                                />
                            </div>

                        </div>

                        <div className={styles.filterActions}>
                            <button className={styles.loginButton} onClick={handleSearchPurchaseInvoices}>
                                {isSearchingPurchase ? "Đang tìm kiếm..." : "Tìm kiếm"}
                            </button>
                            <button className={styles.exportButton} onClick={handleExportPurchaseInvoices}>
                                {isExportingPurchase ? "Đang xuất file..." : "Xuất Excel"}
                            </button>
                            <button
                                className={styles.compareButton}
                                onClick={handleOpenCompareFilePicker}
                                disabled={isComparingPurchase || !purchaseData}
                                title={!purchaseData ? "Vui lòng tìm kiếm dữ liệu trước" : undefined}
                            >
                                {isComparingPurchase ? "Đang đối xoát..." : "Đối xoát dữ liệu với file"}
                            </button>
                            <input
                                ref={compareFileInputRef}
                                type="file"
                                onChange={handleComparePurchaseFileChange}
                                className={styles.hiddenFileInput}
                            />
                            <span className={styles.helperText}>Tra cứu tối đa 12 tháng.</span>
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

                        <form onSubmit={handleLoginSubmit}>
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

                            <button type="submit" className={styles.loginButton}>
                                {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                            </button>
                        </form>

                        <div className={styles.quickLoginSection}>
                            <div className={styles.quickLoginHeader}>
                                <h3>Tài khoản đăng nhập gần đây</h3>
                                <button
                                    type="button"
                                    className={styles.refreshRecentButton}
                                    onClick={loadRecentLoggedInvoiceUsers}
                                    disabled={isLoadingRecentUsers}
                                >
                                    {isLoadingRecentUsers ? "Đang tải..." : "Tải lại"}
                                </button>
                            </div>

                            {isLoadingRecentUsers ? (
                                <p className={styles.quickLoginHint}>Đang tải danh sách tài khoản...</p>
                            ) : recentAccounts.length === 0 ? (
                                <p className={styles.quickLoginHint}>Chưa có tài khoản đăng nhập gần đây.</p>
                            ) : (
                                <div className={styles.quickLoginList}>
                                    {recentAccounts.map((item) => (
                                        <label key={item.key} className={styles.quickLoginOption}>
                                            <input
                                                type="radio"
                                                name="recentInvoiceUser"
                                                value={item.key}
                                                checked={selectedRecentUsername === item.key}
                                                onChange={(e) => setSelectedRecentUsername(e.target.value)}
                                            />
                                            <span>{item.value ? `${item.key} - ${item.value}` : item.key}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                className={styles.quickLoginButton}
                                onClick={handleQuickLogin}
                                disabled={isQuickLoggingIn || !selectedRecentUsername}
                            >
                                {isQuickLoggingIn ? "Đang đăng nhập nhanh..." : "Đăng nhập nhanh"}
                            </button>
                        </div>

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

            {comparePurchaseContext ? (
                <div className={styles.compareModalOverlay}>
                    <div className={styles.compareModal}>
                        <h3>Xác nhận đối xoát dữ liệu</h3>
                        <p>
                            Bạn có muốn đối xoát file {comparePurchaseContext.file.name} đã chọn với dữ liệu đang tìm kiếm không ?
                        </p>
                        <div className={styles.compareModalActions}>
                            <button
                                type="button"
                                className={styles.compareModalCancelButton}
                                onClick={handleCancelComparePurchase}
                                disabled={isComparingPurchase}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className={styles.compareModalConfirmButton}
                                onClick={handleConfirmComparePurchase}
                                disabled={isComparingPurchase}
                            >
                                {isComparingPurchase ? "Đang đối xoát..." : "Xác nhận"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {compareResultData ? (
                <div className={styles.compareResultOverlay}>
                    <div className={styles.compareResultModal}>
                        <div className={styles.compareResultHeader}>
                            <h3>Kết quả đối xoát dữ liệu</h3>
                            <button
                                type="button"
                                className={styles.compareResultCloseButton}
                                onClick={handleCloseCompareResult}
                            >
                                Đóng
                            </button>
                        </div>
                        <div className={styles.compareResultBody}>
                            <div className={styles.compareResultColumn}>
                                <div className={styles.compareResultColumnTitle}>
                                    Kết quả từ file ({compareResultData.myErrorArr.length} mục)
                                </div>
                                <div className={styles.compareResultList}>
                                    {compareResultData.myErrorArr.length === 0 ? (
                                        <div className={styles.compareResultEmpty}>Không có lỗi</div>
                                    ) : (
                                        compareResultData.myErrorArr.map((item, idx) => (
                                            <div key={idx} className={styles.compareResultItem}>
                                                <span className={styles.compareResultRow}>Dòng {item.row}</span>
                                                <span className={styles.compareResultDesc}>{item.description}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className={styles.compareResultColumn}>
                                <div className={styles.compareResultColumnTitle}>
                                    Kết quả đối chiếu thuế ({compareResultData.taxErrorArr.length} mục)
                                </div>
                                <div className={styles.compareResultList}>
                                    {compareResultData.taxErrorArr.length === 0 ? (
                                        <div className={styles.compareResultEmpty}>Không có lỗi</div>
                                    ) : (
                                        compareResultData.taxErrorArr.map((item, idx) => (
                                            <div key={idx} className={styles.compareResultItem}>
                                                <span className={styles.compareResultRow}>Dòng {item.row}</span>
                                                <span className={styles.compareResultDesc}>{item.description}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}