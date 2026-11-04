"use client";

import { useRouter } from "next/navigation";
import styles from "../../styles/menu.module.css";
import { useEffect } from "react";
import { CompareIcon, InvoiceIcon, ConvertIcon, SearchIcon, ArrowRightIcon, LogoutIcon } from "../../components/Icons";

export default function MenuPage() {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        router.replace("/");
    };

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            router.push("/");
        }
    }, [router]);

    const modules = [
        {
            name: "So khớp trên file excel",
            desc: "Đối chiếu dữ liệu giữa các file Excel và phát hiện chênh lệch nhanh chóng.",
            path: "/file",
            icon: <CompareIcon size={26} />,
            tone: styles.toneBlue,
        },
        {
            name: "Hoá đơn điện tử",
            desc: "Tra cứu, xem và tải hoá đơn điện tử mua vào, bán ra.",
            path: "/invoice",
            icon: <InvoiceIcon size={26} />,
            tone: styles.toneTeal,
        },
        {
            name: "Chuyển mã file excel",
            desc: "Import file Excel và chuyển đổi mã hàng loạt chỉ với vài thao tác.",
            path: "/transcoding",
            icon: <ConvertIcon size={26} />,
            tone: styles.toneAmber,
        },
        {
            name: "Tra cứu mã số thuế",
            desc: "Tra cứu thông tin doanh nghiệp, cá nhân theo mã số thuế.",
            path: "/tax-lookup",
            icon: <SearchIcon size={26} />,
            tone: styles.tonePurple,
        },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.headerBox}>
                <h1 className={styles.title}>Menu chức năng</h1>
                <p className={styles.subtitle}>
                    Chọn chức năng bạn muốn sử dụng
                </p>
                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.logoutButton}
                        onClick={handleLogout}
                    >
                        <LogoutIcon size={16} />
                        Đăng xuất
                    </button>
                </div>
            </div>

            <div className={styles.grid}>
                {modules.map((item) => (
                    <button
                        type="button"
                        key={item.path}
                        className={`${styles.card} ${item.tone}`}
                        onClick={() => router.push(item.path)}
                    >
                        <span className={styles.cardIcon}>{item.icon}</span>
                        <div>
                            <span className={styles.cardName}>{item.name}</span>
                            <p className={styles.cardDesc}>{item.desc}</p>
                        </div>
                        <span className={styles.cardFooter}>
                            Mở chức năng
                            <ArrowRightIcon size={16} className={styles.cardArrow} />
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}