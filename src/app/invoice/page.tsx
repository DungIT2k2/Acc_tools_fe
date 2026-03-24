"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    nmmst: string;
    nmten: string;
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

type InvoiceFeatureConfig = {
    id: number;
    title: string;
    apiEndpoint: string;
    exportEndpoint: string;
    compareEndpoint: string;
    dataKeys: Array<{ key: string; title: string }>;
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
    row: number | string;
    description: string;
    shd?: string | number | null;
    serihd?: string | number | null;
    tdlap?: string | number | null;
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

const INVOICE_FEATURES: InvoiceFeatureConfig[] = [
    {
        id: 1,
        title: "Lấy hoá đơn mua",
        apiEndpoint: "/invoice/getPurchaseInvoice",
        exportEndpoint: "/invoice/exportPurchaseInvoice",
        compareEndpoint: "/invoice/comparePurchaseInvoice",
        dataKeys: [
            { key: "invoiceIssuedData", title: "Đã cấp mã hoá đơn" },
            { key: "invoiceNoCodeData", title: "Cục Thuế đã nhận không mã" },
            { key: "invoiceCashRegisterData", title: "Cục Thuế đã nhận hoá đơn có mã khởi tạo từ máy tính tiền" },
        ],
    },
    {
        id: 2,
        title: "Lấy hoá đơn bán",
        apiEndpoint: "/invoice/getSoldInvoice",
        exportEndpoint: "/invoice/exportSoldInvoice",
        compareEndpoint: "/invoice/compareSoldInvoice",
        dataKeys: [
            { key: "invoiceElectronicData", title: "Hoá đơn điện tử" },
            { key: "invoiceCashRegisterData", title: "Hoá đơn có mã khởi tạo từ máy tính tiền" },
        ],
    },
];

function formatCompareItemField(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    return String(value);
}

function buildCompareRowMeta(item: CompareErrorItem): string {
    return `Dòng ${item.row} - Số hoá đơn: ${formatCompareItemField(item.shd)} - Ký hiệu hoá đơn: ${formatCompareItemField(item.serihd)} - Ngày lập: ${formatCompareItemField(item.tdlap)}`;
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

function normalizeInvoiceResponse(data: unknown, keys: string[]): Record<string, InvoiceSectionData> {
    const result: Record<string, InvoiceSectionData> = {};

    if (Array.isArray(data) && data.some((item) => isInvoiceSectionError(item))) {
        const errorSection = createInvoiceSectionError();
        keys.forEach((key) => {
            result[key] = errorSection;
        });
        return result;
    }

    if (typeof data !== "object" || data === null) {
        keys.forEach((key) => {
            result[key] = [];
        });
        return result;
    }

    const response = data as Record<string, unknown>;

    keys.forEach((key) => {
        result[key] = normalizeInvoiceSectionData(response[key]);
    });

    return result;
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

function hasFieldValueInData(
    invoiceData: Record<string, InvoiceSectionData> | null,
    field: keyof InvoiceRow,
): boolean {
    if (!invoiceData) {
        return false;
    }

    return Object.values(invoiceData).some((section) => {
        if (!Array.isArray(section)) {
            return false;
        }

        return section.some((item) => {
            if (isInvoiceSectionError(item)) {
                return false;
            }

            const row = item as InvoiceRow;
            return Object.prototype.hasOwnProperty.call(row, field);
        });
    });
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
    { header: formatHeaderLabel("MST người mua"), field: "nmmst" },
    { header: formatHeaderLabel("Tên người mua"), field: "nmten" },
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
    const [hasSearchedPurchase, setHasSearchedPurchase] = useState(false);
    const [purchaseError, setPurchaseError] = useState("");
    const [isSearchingPurchase, setIsSearchingPurchase] = useState(false);
    const [isExportingPurchase, setIsExportingPurchase] = useState(false);
    const [isComparingPurchase, setIsComparingPurchase] = useState(false);
    const [comparePurchaseContext, setComparePurchaseContext] = useState<ComparePurchaseContext | null>(null);
    const [compareResultData, setCompareResultData] = useState<CompareResultData | null>(null);
    const [invoiceData, setInvoiceData] = useState<Record<string, InvoiceSectionData> | null>(null);
    const [collapsedTables, setCollapsedTables] = useState({
        issued: false,
        noCode: false,
        cashRegister: false,
    });

    const invoiceColumns = useMemo(() => {
        return PURCHASE_INVOICE_COLUMNS.filter((column) => {
            if (column.field === "nmmst" || column.field === "nmten" || column.field === "nbmst" || column.field === "nbten" || column.field === "tgtphi") {
                return hasFieldValueInData(invoiceData, column.field as keyof InvoiceRow);
            }

            return true;
        });
    }, [invoiceData]);
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
            const res = await callApi.get<unknown>("/invoice/listLoggedInvoice");
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
            const res = await callApi.post("/invoice/loginInvoice", {
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
            const res = await callApi.post("/invoice/loginInvoice", {
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

        setInvoiceData(null);
        setHasSearchedPurchase(false);
        setPurchaseError("");
        setCompareResultData(null);
        setComparePurchaseContext(null);
    };

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            const res = await callApi.post("/invoice/logoutInvoice");

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
            setInvoiceData(null);
            setHasSearchedPurchase(false);
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

            const featureConfig = INVOICE_FEATURES.find((f) => f.id === selectedFeature);
            if (!featureConfig) {
                setPurchaseError("Chức năng chưa được cấu hình.");
                return;
            }

            const res = await callApi.get<unknown>(featureConfig.apiEndpoint, {
                params: {
                    from: params.from,
                    to: params.to,
                },
            });

            setInvoiceData(normalizeInvoiceResponse(res.data, featureConfig.dataKeys.map((item) => item.key)));
            setHasSearchedPurchase(true);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Không lấy được dữ liệu hoá đơn";
            setPurchaseError(message);
            setInvoiceData(null);
            setHasSearchedPurchase(false);
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

            const featureConfig = INVOICE_FEATURES.find((f) => f.id === selectedFeature);
            if (!featureConfig) {
                setPurchaseError("Chức năng chưa được cấu hình.");
                return;
            }

            const res = await callApi.get<Blob>(featureConfig.exportEndpoint, {
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

            const featureConfig = INVOICE_FEATURES.find((f) => f.id === selectedFeature);
            if (!featureConfig) {
                setPurchaseError("Chức năng chưa được cấu hình đối xoát dữ liệu.");
                return;
            }

            const res = await callApi.post<unknown>(featureConfig.compareEndpoint, formData, {
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
        setHasSearchedPurchase(false);
    };

    const handlePurchaseToDateChange = (value: string) => {
        setPurchaseToDate(toEndOfMonthInputValue(value));
        setHasSearchedPurchase(false);
    };

    const toggleTableSection = (section: "issued" | "noCode" | "cashRegister") => {
        setCollapsedTables((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const renderFeatureContent = () => {
        const featureConfig = INVOICE_FEATURES.find((f) => f.id === selectedFeature);
        if (!featureConfig) {
            return "Chức năng không hợp lệ";
        }

        const getSectionKey = (sectionKey: string) => {
            if (sectionKey === "invoiceIssuedData" || sectionKey === "invoiceElectronicData") {
                return "issued" as const;
            }
            if (sectionKey === "invoiceNoCodeData") {
                return "noCode" as const;
            }
            if (sectionKey === "invoiceCashRegisterData") {
                return "cashRegister" as const;
            }

            return "issued" as const;
        };

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
                        <button
                            className={styles.exportButton}
                            onClick={handleExportPurchaseInvoices}
                            disabled={isExportingPurchase || !invoiceData || !hasSearchedPurchase}
                            title={!hasSearchedPurchase ? "Vui lòng bấm Tìm kiếm trước khi xuất file" : undefined}
                        >
                            {isExportingPurchase ? "Đang xuất file..." : "Xuất Excel"}
                        </button>
                        <button
                            className={styles.compareButton}
                            onClick={handleOpenCompareFilePicker}
                            disabled={isComparingPurchase || !invoiceData}
                            title={!invoiceData ? "Vui lòng tìm kiếm dữ liệu trước" : undefined}
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

                {featureConfig.dataKeys.map((section) => {
                    const table = resolveSectionTable(invoiceData?.[section.key], "Chưa có dữ liệu hoá đơn này");
                    const collapseKey = getSectionKey(section.key);

                    return (
                        <div key={section.key} className={styles.tableSection}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionHeaderLeft}>
                                    <button
                                        className={`${styles.collapseButton} ${collapsedTables[collapseKey] ? styles.collapseButtonCollapsed : ""}`}
                                        onClick={() => toggleTableSection(collapseKey)}
                                    >
                                        <span>&gt;</span>
                                    </button>
                                    <h3>{section.title}</h3>
                                </div>
                                <span>{table.count} dòng</span>
                            </div>
                            {!collapsedTables[collapseKey] ? (
                                <div className={styles.tableWrapper}>
                                    <DynamicTable
                                        columns={invoiceColumns}
                                        data={table.rows}
                                        emptyText={table.emptyText}
                                        tableClassName={styles.dataTable}
                                        headClassName={styles.tableHeadCell}
                                        cellClassName={styles.tableCell}
                                        emptyClassName={styles.emptyState}
                                    />
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
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
                            {[1, 2].map((feature) => (
                                <button
                                    key={feature}
                                    className={`${styles.menuButton} ${selectedFeature === feature ? styles.menuButtonActive : ""}`}
                                    onClick={() => handleSelectFeature(feature)}
                                >
                                    {feature === 1 ? "Lấy hoá đơn mua" : "Lấy hoá đơn bán"}
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
                        <h2 className={selectedFeature === 1 ? styles.titlePurchase : styles.titleSold}>
                            {INVOICE_FEATURES.find((feature) => feature.id === selectedFeature)?.title || "Review dữ liệu"}
                        </h2>
                        <div className={styles.previewBox}>
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
                                                <span className={styles.compareResultRow}>{buildCompareRowMeta(item)}</span>
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
                                                <span className={styles.compareResultRow}>{buildCompareRowMeta(item)}</span>
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
