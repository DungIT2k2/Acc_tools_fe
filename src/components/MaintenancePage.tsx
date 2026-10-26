"use client";

import styles from "../styles/maintenance.module.css";

type MaintenancePageProps = {
  message: string;
  isChecking: boolean;
  onRetry: () => void;
};

export default function MaintenancePage({ message, isChecking, onRetry }: MaintenancePageProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card} role="alert" aria-live="assertive">
        <div className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 className={styles.title}>{message}</h1>
        <p className={styles.description}>
          Hệ thống đang được nâng cấp để mang lại trải nghiệm tốt hơn.
          Vui lòng quay lại sau ít phút.
        </p>

        <div className={styles.contact}>
          Cần thêm thông tin, vui lòng liên hệ <strong>Admin</strong>.
        </div>

        <button type="button" className={styles.retryButton} onClick={onRetry} disabled={isChecking}>
          {isChecking ? "Đang kiểm tra..." : "Thử lại"}
        </button>
        <p className={styles.hint}>Trang sẽ tự động tải lại khi hệ thống hoạt động trở lại.</p>
      </section>
    </main>
  );
}
