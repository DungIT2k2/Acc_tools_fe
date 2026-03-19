"use client";

import { useState } from "react";
import callApi from "../../lib/axios";
import styles from "../../styles/module.module.css";
import { useRouter } from "next/navigation";

export default function ModulePage() {
    const [myFile, setMyFile] = useState<File | null>(null);
    const [taxFile, setTaxFile] = useState<File | null>(null);

    const [result, setResult] = useState<any>(null);
    const [showPopup, setShowPopup] = useState(false);
    const router = useRouter()

    const handleSubmit = async () => {
        if (!myFile || !taxFile) {
            alert("Vui lòng chọn đủ 2 file");
            return;
        }

        try {
            const formData = new FormData();
            formData.append("myFile", myFile);
            formData.append("taxFile", taxFile);

            const res = await callApi.post("/module/handle", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setResult(res.data);
            setShowPopup(true);
        } catch (err: any) {
            const message =
                err?.response?.data?.message || "Có lỗi xảy ra";
            alert(message);
        }
    };

    return (
        <div className={styles.container}>
            {/* 👇 NÚT BACK */}
            <button
                className={styles.backButton}
                onClick={() => router.push("/menu")}
            >
                ← Quay về menu
            </button>
            <h1>So khớp với file thuế</h1>

            <div className={styles.uploadBox}>
                <div>
                    <label>File của tôi:</label>
                    <input type="file" onChange={(e) => setMyFile(e.target.files?.[0] || null)} />
                </div>

                <div>
                    <label>File của thuế:</label>
                    <input type="file" onChange={(e) => setTaxFile(e.target.files?.[0] || null)} />
                </div>
            </div>

            <button className={styles.button} onClick={handleSubmit}>
                Upload & So sánh
            </button>

            {/* POPUP */}
            {showPopup && result && (
                <div className={styles.overlay}>
                    <div className={styles.popup}>
                        <h2>Kết quả đối soát</h2>

                        <div className={styles.grid}>
                            {/* BÊN TRÁI */}
                            <div>
                                <h3>File của tôi</h3>
                                <div className={styles.list}>
                                    {result.myErrorArr?.length === 0 && <p>Không có lỗi</p>}
                                    {result.myErrorArr?.map((item: any, index: number) => (
                                        <div key={index} className={styles.errorItem}>
                                            STT {item.row}: {item.description}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BÊN PHẢI */}
                            <div>
                                <h3>File thuế</h3>
                                <div className={styles.list}>
                                    {result.taxErrorArr?.length === 0 && <p>Không có lỗi</p>}
                                    {result.taxErrorArr?.map((item: any, index: number) => (
                                        <div key={index} className={styles.errorItem}>
                                            STT {item.row}: {item.description}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setShowPopup(false)}>Đóng</button>
                    </div>
                </div>
            )}
        </div>
    );
}