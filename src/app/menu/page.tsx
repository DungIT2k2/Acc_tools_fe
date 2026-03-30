"use client";

import { useRouter } from "next/navigation";
import styles from "../../styles/menu.module.css";
import { useEffect } from "react";

export default function MenuPage() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            router.push("/");
        }
    }, [router]);

    const modules = [
        // {
        //     name: "So khớp với file thuế",
        //     path: "/module",
        //     icon: "📊",
        // },
        {
            name: "Hoá đơn điện tử",
            path: "/invoice",
            icon: "🧾",
        },
        // {
        //     name: "Chức năng 3",
        //     path: "/module-3",
        //     icon: "📁",
        // },
        // {
        //     name: "Chức năng 4",
        //     path: "/module-4",
        //     icon: "⚙️",
        // },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.headerBox}>
                <h1 className={styles.title}>Menu chức năng</h1>
                <p className={styles.subtitle}>
                    Chọn chức năng bạn muốn sử dụng
                </p>
            </div>

            <div className={styles.grid}>
                {modules.map((item, index) => (
                    <div
                        key={index}
                        className={styles.card}
                        onClick={() => router.push(item.path)}
                    >
                        <div className={styles.cardTop}>
                            <span className={styles.cardIcon}>{item.icon}</span>
                            <span className={styles.cardName}>{item.name}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}