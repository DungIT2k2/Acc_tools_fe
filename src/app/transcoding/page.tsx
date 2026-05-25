"use client";

import { useCallback, useRef, useState } from "react";
import styles from "../../styles/transcoding.module.css";
import callApi from "@/src/lib/axios";

export default function TranscodingPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((selected: File | null) => {
        setError(null);
        setSuccess(null);
        if (!selected) return;
        const ext = selected.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls"].includes(ext ?? "")) {
            setError("Chỉ chấp nhận file Excel (.xlsx, .xls).");
            return;
        }
        setFile(selected);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e.target.files?.[0] ?? null);
        e.target.value = "";
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFileChange(e.dataTransfer.files?.[0] ?? null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => setIsDragOver(false);

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFile(null);
        setError(null);
        setSuccess(null);
    };

    const handleSubmit = async () => {
        if (!file) {
            setError("Vui lòng chọn file Excel trước khi chuyển mã.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData();
            formData.append("File", file);

            const response = await callApi.post("/file/transcoding", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                responseType: "arraybuffer",
            });

            const contentDisposition = response.headers?.["content-disposition"] ?? "";
            let fileName = "transcoding_output.xlsx";
            const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
            if (match?.[1]) {
                fileName = decodeURIComponent(match[1].trim());
            }

            const blob = new Blob([response.data], {
                type: response.headers?.["content-type"] ?? "application/octet-stream",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            setSuccess(`Chuyển mã thành công! File "${fileName}" đã được tải về.`);
        } catch (err: unknown) {
            const anyErr = err as { response?: { status?: number; data?: ArrayBuffer } };
            if (anyErr?.response?.data) {
                try {
                    const text = new TextDecoder().decode(anyErr.response.data);
                    const json = JSON.parse(text);
                    setError(json?.message ?? json?.error ?? "Chuyển mã thất bại. Vui lòng thử lại.");
                } catch {
                    setError("Chuyển mã thất bại. Vui lòng thử lại.");
                }
            } else {
                setError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại.");
            }
        } finally {
            setLoading(false);
        }
    };

    const dropZoneClass = [
        styles.dropZone,
        isDragOver ? styles.dropZoneActive : "",
        file ? styles.dropZoneHasFile : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Chuyển mã Excel</h1>
                <p className={styles.subtitle}>Import file Excel và chuyển mã ngay lập tức</p>

                {/* Drop zone */}
                <div
                    className={dropZoneClass}
                    onClick={() => inputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    {file && (
                        <button className={styles.clearBtn} onClick={handleClear} title="Xóa file">
                            ✕
                        </button>
                    )}
                    <span className={styles.dropZoneIcon}>{file ? "📊" : "📂"}</span>
                    {file ? (
                        <p className={styles.dropZoneFileName}>{file.name}</p>
                    ) : (
                        <p className={styles.dropZoneText}>
                            Kéo thả file vào đây hoặc{" "}
                            <strong style={{ color: "#3b82f6" }}>nhấn để chọn file</strong>
                            <br />
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Hỗ trợ: .xlsx, .xls</span>
                        </p>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className={styles.fileInput}
                        onChange={handleInputChange}
                    />
                </div>

                {/* Submit button */}
                <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={loading || !file}
                >
                    {loading && <span className={styles.spinner} />}
                    {loading ? "Đang chuyển mã..." : "Chuyển mã ngay"}
                </button>

                {/* Messages */}
                {error && <p className={styles.errorMsg}>{error}</p>}
                {success && <p className={styles.successMsg}>{success}</p>}
            </div>
        </div>
    );
}
