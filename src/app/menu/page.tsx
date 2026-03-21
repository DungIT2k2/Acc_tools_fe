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
    }, []);

    const modules = [
        { name: "So khớp với file thuế", path: "/module" },
        { name: "Hoá đơn điện tử", path: "/invoice" },
        { name: "Chức năng 3", path: "/module-3" },
        { name: "Chức năng 4", path: "/module-4" },
    ];

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Menu</h1>

            <div className={styles.grid}>
                {modules.map((item, index) => (
                    <div
                        key={index}
                        className={styles.card}
                        onClick={() => router.push(item.path)}
                    >
                        {item.name}
                    </div>
                ))}
            </div>
        </div>
    );
}