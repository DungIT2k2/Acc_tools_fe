import styles from "../styles/santa.module.css";

/** Ông già Noel (CSS thuần). covered = true thì đưa găng tay che mắt. */
export default function Santa({ covered }: { covered: boolean }) {
  return (
    <div data-keep-light className={`${styles.face} ${covered ? styles.cover : ""}`}>
      <span className={styles.hat}></span>
      <span className={styles.pom}></span>
      <span className={styles.trim}></span>

      <div className={styles.head}>
        <span className={`${styles.eye} ${styles.eyeLeft}`}></span>
        <span className={`${styles.eye} ${styles.eyeRight}`}></span>
        <span className={styles.nose}></span>
      </div>

      <span className={styles.beard}></span>
      <span className={styles.mouth}></span>

      <span className={`${styles.mitten} ${styles.mittenLeft}`}></span>
      <span className={`${styles.mitten} ${styles.mittenRight}`}></span>
    </div>
  );
}
