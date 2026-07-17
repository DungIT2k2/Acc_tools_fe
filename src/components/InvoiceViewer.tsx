import React from "react";
import styles from "../styles/invoice.module.css";
import { QRCodeCanvas } from "qrcode.react";

type Props = { data: any };

function formatCurrency(value: any) {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("vi-VN").format(Math.round(num));
}

function formatDateLong(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `Ngày ${day} tháng ${month} năm ${year}`;
  } catch {
    return String(iso);
  }
}

export default function InvoiceViewer({ data }: Props) {
  if (!data) return <div>Không có dữ liệu hoá đơn</div>;

  const sellerName = data.nbten ?? data.nmten ?? "";
  const sellerMst = data.nbmst ?? "";
  const sellerAddress = data.nbdchi ?? data.nmdchi ?? "";
  const sellerPhone = data.nbsdthoai ?? data.nmsdthoai ?? "";
  const sellerBank = data.nmstttoan ?? data.nmttttoan ?? "";

  const buyerName = data.nmten ?? "";
  const buyerMst = data.nmmst ?? "";
  const buyerAddress = data.nmdchi ?? "";
  const buyerPayment = data.thtttoan ?? (data.tttbao === 1 ? "Chuyển khoản" : "Tiền mặt");
  const currency = data.dvtte ?? "VND";

  const invoiceSeries = data.khhdon ?? "";
  const invoiceNo = data.shdon ?? "";
  const modelNo = data.khmshdon ?? "";
  const issueDate = data.tdlap ?? data.tgia ?? data.ntao ?? "";

  const items = Array.isArray(data.hdhhdvu) ? data.hdhhdvu : [];

  const subtotal = formatCurrency(data.tgtcthue ?? 0);
  const tax = formatCurrency(data.tgtthue ?? 0);
  const total = formatCurrency(data.tgtttbso ?? 0);
  const amountInWords = data.tgtttbchu ?? "";
  const nbcksInfo = (() => {
    try {
      const parsed = JSON.parse(data.nbcks ?? "{}");
      const subject: string = parsed.Subject ?? "";
      const cnMatch = subject.match(/CN=([^,]+)/);
      return {
        cn: cnMatch ? cnMatch[1] : "",
        signingTime: parsed.SigningTime ?? "",
      };
    } catch {
      return { cn: "", signingTime: "" };
    }
  })();

  return (
    <div className={styles.invoiceA4}>
      <div className={styles.invHeader}>

        <div className={styles.invHeaderTop}>
          <div className={styles.invHeaderLeft}>
            <QRCodeCanvas value={String(data.qrcode ?? "")} size={100} />
          </div>

          <div className={styles.invHeaderRight}>
            <div className={styles.metaRows}>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Mẫu số</span><span className={styles.metaValue}>{modelNo || ""}</span></div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Ký hiệu:</span><span className={styles.metaValue}>{invoiceSeries || ""}</span></div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Số:</span><span className={styles.metaValue}>{invoiceNo || ""}</span></div>
            </div>
          </div>
        </div>

        <div className={styles.invHeaderBottom}>
          <div className={styles.titleBlock}>
            <div className={styles.invoiceTitle}>HOÁ ĐƠN GIÁ TRỊ GIA TĂNG</div>
            <div className={styles.invoiceDate}>{formatDateLong(issueDate)}</div>
            <div className={styles.invoiceCQT}>MCCQT: {data.mhdon ?? ""}</div>
          </div>
        </div>

      </div>

      <div className={styles.partySeparator} />

      <div className={styles.partySection}>
        {/* Seller block (stacked) */}
        <div className={styles.sellerBlock}>
          <div className={styles.infoRow}>
            <div className={styles.label}>Tên người bán: {sellerName}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Mã số thuế: {sellerMst}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Địa chỉ: {sellerAddress}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Điện thoại: {sellerPhone}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Số tài khoản: {sellerBank}</div>
          </div>
        </div>

        <div className={styles.partySeparator} />

        {/* Buyer block (stacked) */}
        <div className={styles.buyerBlock}>
          <div className={styles.infoRow}>
            <div className={styles.label}>Tên người mua: {buyerName}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Họ tên người mua hàng: {data.hotennguoinhan ?? ""}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Mã số thuế: {buyerMst}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Địa chỉ: {buyerAddress}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Hình thức thanh toán: {buyerPayment}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Số tài khoản: {data.nmstkhoan ?? ""}</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>Đơn vị tiền tệ: {currency}</div>
          </div>
          <div className={`${styles.infoRow} ${styles.infoRowInline}`}>
            <div className={styles.label}>Số bảng kê: </div>
            <div className={styles.label}>Ngày bảng kê: </div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.invoiceTable}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th style={{ width: 60 }}>Tính<br/>chất</th>
              <th style={{ width: 90 }}>Loại<br/>hàng<br/>hoá<br/>đặc<br/>trưng</th>
              <th>Tên hàng hóa, dịch vụ</th>
              <th style={{ width: 70 }}>Đơn<br/>vị<br/>tính</th>
              <th style={{ width: 70 }}>Số<br/>lượng</th>
              <th style={{ width: 110 }}>Đơn<br/>giá</th>
              <th style={{ width: 80 }}>Chiết<br/>khấu</th>
              <th style={{ width: 70 }}>Thuế<br/>suất</th>
              <th style={{ width: 140 }}>Thành tiền<br/>chưa có thuế<br/>GTGT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 8 }}>Không có mặt hàng</td>
              </tr>
            ) : (
              items.map((it: any, idx: number) => (
                <tr key={idx}>
                  <td className={styles.tc}>{idx + 1}</td>
                  <td className={styles.tc}>{it.tchat ?? ""}</td>
                  <td className={styles.tc}></td>
                  <td className={styles.tl}>{it.ten ?? it.description ?? ""}</td>
                  <td className={styles.tc}>{it.dvtinh ?? it.dvtte ?? ""}</td>
                  <td className={styles.tc}>{it.sluong ?? ""}</td>
                  <td className={styles.tr}>{formatCurrency(it.dgia ?? 0)}</td>
                  <td className={styles.tr}>{formatCurrency(it.stckhau ?? 0)}</td>
                  <td className={styles.tc}>{it.ltsuat ?? it.tsuat ?? ""}</td>
                  <td className={styles.tr}>{formatCurrency(it.thtien ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryLeftTableWrapper}>
          <table className={styles.summaryTableLeft}>
            <thead>
              <tr>
                <th>Thuế suất</th>
                <th>Tổng tiền chưa thuế</th>
                <th>Tổng tiền thuế</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.summaryCenter}>{data.ltsuat ?? data.tsuat ?? ""}</td>
                <td className={styles.summaryRightAlign}>{subtotal}</td>
                <td className={styles.summaryRightAlign}>{tax}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.summaryRightTableWrapper}>
          <table className={styles.summaryTableRight}>
            <tbody>
              <tr>
                <td className={styles.summaryDescription}>
                  Tổng tiền chưa thuế<br />
                  <span className={styles.summaryNote}>(Tổng cộng thành tiền chưa có thuế)</span>
                </td>
                <td className={styles.summaryRightAlign}>{subtotal}</td>
              </tr>
              <tr>
                <td className={styles.summaryDescription}>
                  Tổng tiền thuế<br />
                  <span className={styles.summaryNote}>(Tổng cộng tiền thuế)</span>
                </td>
                <td className={styles.summaryRightAlign}>{tax}</td>
              </tr>
              <tr>
                <td className={styles.summaryDescription}>Tổng tiền phí</td>
                <td className={styles.summaryRightAlign}>{formatCurrency(data.tgttphi ?? 0)}</td>
              </tr>
              <tr>
                <td className={styles.summaryDescription}>Tổng tiền chiết khấu thương mại</td>
                <td className={styles.summaryRightAlign}>{formatCurrency(data.ttcktmai ?? 0)}</td>
              </tr>
              <tr>
                <td className={`${styles.summaryDescription}`}>Tổng tiền thanh toán bằng số</td>
                <td className={`${styles.summaryRightAlign}`}>{total}</td>
              </tr>
              <tr>
                <td className={styles.summaryDescription}>Tổng tiền thanh toán bằng chữ</td>
                <td className={`${styles.summaryRightAlign} ${styles.summaryAmountWords}`}>{amountInWords || ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.partySeparator} />

      <div className={styles.signatureArea}>
        <div className={styles.sigBlock}>
          <div style={{ marginBottom: "1em" }}>NGUỜI MUA HÀNG</div>
          <div style={{ fontSize: "14px", fontStyle: "italic" }}>(Chữ ký số (nếu có))</div>
        </div>
        <div className={styles.sigBlock}>
          <div style={{ marginBottom: "1em" }}>NGUỜI BÁN HÀNG</div>
          <div style={{ fontSize: "14px", fontStyle: "italic" }}>(Chữ ký điện tử, chữ ký số)</div>
          <div className={styles.signBox}>
            <div className={styles.signBoxLine}>Signature Valid</div>
            <div className={styles.signBoxLine}>Ký bởi {nbcksInfo.cn}</div>
            <div className={styles.signBoxLine}>Ký ngày: {nbcksInfo.signingTime}</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</div>
      </div>
    </div>
  );
}