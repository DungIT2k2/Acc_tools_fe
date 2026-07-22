import React from "react";
import styles from "../styles/invoice.module.css";
import { QRCodeCanvas } from "qrcode.react";

type Props = { data: any; isSco?: boolean };

type ThueSuatItem = {
  tsuat?: string | number | null;
  thtien?: number | null;
  tthue?: number | null;
  gttsuat?: number | null;
};

type ListHoaDonDichVuItem = {
  tchat?: string | number | null;
  ten?: string | null;
  description?: string | null;
  dvtinh?: string | null;
  dvtte?: string | null;
  sluong?: number | null;
  dgia?: number | null;
  stckhau?: number | null;
  ltsuat?: string | number | null;
  tsuat?: string | number | null;
  thtien?: number | null;
};

function formatCurrency(value: any) {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("vi-VN").format(Math.round(num));
}

const TCHAT_LABELS: Record<string, string> = {
  "1": "Hàng hóa, dịch vụ",
};

function formatTchat(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "";
  return TCHAT_LABELS[String(value)] ?? String(value);
}

function formatDateLong(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return (
      <>
        Ngày <span className={styles.valueText}>{day}</span> tháng <span className={styles.valueText}>{month}</span> năm <span className={styles.valueText}>{year}</span>
      </>
    );
  } catch {
    return String(iso);
  }
}

export default function InvoiceViewer({ data, isSco }: Props) {
  if (!data) return <div>Không có dữ liệu hoá đơn</div>;

  const sellerName = data.nbten ?? data.nmten ?? "";
  const sellerMst = data.nbmst ?? "";
  const sellerAddress = data.nbdchi ?? data.nmdchi ?? "";
  const sellerPhone = data.nbsdthoai ?? data.nmsdthoai ?? "";

  const buyerName = data.nmten ?? "";
  const buyerMst = data.nmmst ?? "";
  const buyerAddress = data.nmdchi ?? "";
  const buyerPayment = data.thtttoan ? (data.tttbao === 1 ? "Tiền mặt/Chuyển khoản" : "Tiền mặt") : "";
  const currency = data.dvtte ?? "VND";

  const invoiceSeries = data.khhdon ?? "";
  const invoiceNo = data.shdon ?? "";
  const modelNo = data.khmshdon ?? "";
  const issueDate = data.tdlap ?? data.tgia ?? data.ntao ?? "";

  const listHoaDonDichVu: ListHoaDonDichVuItem[] = Array.isArray(data.hdhhdvu) ? data.hdhhdvu : [];
  const sellerBank = `${data.nbstkhoan ?? ""} ${data.nbtnhang ?? ""}`;

  const subtotal = formatCurrency(data.tgtcthue ?? 0);
  const fee = data.tgttphi != null ? formatCurrency(data.tgttphi) : "";
  const tax = formatCurrency(data.tgtthue ?? 0);
  const total = formatCurrency(data.tgtttbso ?? 0);
  const amountInWords = data.tgtttbchu ?? "";
  const listThueSuat: ThueSuatItem[] = data.thttltsuat ?? data.thtttsuat ?? [];
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
            <div className={styles.label}>
              <span className={styles.labelText}>Tên người bán:</span>
              <span className={styles.valueText}>{sellerName}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Mã số thuế:</span>
              <span className={styles.valueText}>{sellerMst}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Mã cửa hàng: </span>
              <span className={styles.valueText}></span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Tên cửa hàng: </span>
              <span className={styles.valueText}></span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Địa chỉ:</span>
              <span className={styles.valueText}>{sellerAddress}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Điện thoại:</span>
              <span className={styles.valueText}>{sellerPhone}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Số tài khoản:</span>
              <span className={styles.valueText}>{sellerBank}</span>
            </div>
          </div>
        </div>

        <div className={styles.partySeparator} />

        {/* Buyer block (stacked) */}
        <div className={styles.buyerBlock}>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Tên người mua: </span>
              <span className={styles.valueText}>{buyerName}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Họ tên người mua hàng: </span>
              <span className={styles.valueText}>{data.hotennguoinhan ?? ""}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Mã số thuế: </span>
              <span className={styles.valueText}>{buyerMst}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Mã ĐVCQHVNSNN: </span>
              <span className={styles.valueText}>{data.madvchqhvnsnn ?? ""}</span>
            </div>
          </div>
          { !isSco && (
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>CCCD người mua: </span>
              <span className={styles.valueText}>{data.cccdnguoimua ?? ""}</span>
            </div>
          </div>
          )}
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Số hộ chiếu: </span>
              <span className={styles.valueText}>{data.sohocchieu ?? ""}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Địa chỉ:</span>
              <span className={styles.valueText}>{buyerAddress}</span>
            </div>
          </div>
          { isSco && (
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Điện thoại:</span>
              <span className={styles.valueText}></span>
            </div>
          </div>
          )}
          { isSco && (
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Căn cước công dân:</span>
              <span className={styles.valueText}></span>
            </div>
          </div>
          )}
          { !isSco && (
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Số tài khoản: </span>
              <span className={styles.valueText}>{data.nmstkhoan ?? ""}</span>
            </div>
          </div>
          )}
          <div className={styles.infoRow}>
            <div className={styles.label}>
              <span className={styles.labelText}>Hình thức thanh toán: </span>
              <span className={styles.valueText}>{buyerPayment}</span>
            </div>
          </div>
          { !isSco ? (
          <div className={styles.infoRow} >
            <div className={styles.label}>
              <span className={styles.labelText}>Đơn vị tiền tệ: </span>
              <span className={styles.valueText}>{currency}</span>
            </div>
          </div>
          ) : (
            <div className={`${styles.infoRow} ${styles.infoRowInline}`}>
            <div className={styles.label}>
              <span className={styles.labelText}>Đơn vị tiền tệ: </span>
              <span className={styles.valueText}>{currency}</span>
            </div>
            <div className={styles.label}>
              <span className={styles.labelText}>Tỷ giá: </span>
              <span className={styles.valueText}></span>
            </div>
          </div>
          )}
          <div className={`${styles.infoRow} ${styles.infoRowInline}`}>
            <div className={styles.label}>
              <span className={styles.labelText}>Số bảng kê: </span>
              <span className={styles.valueText}>{data.sobangke ?? ""}</span>
            </div>
            <div className={styles.label}>
              <span className={styles.labelText}>Ngày bảng kê: </span>
              <span className={styles.valueText}>{data.ngaybangke ?? ""}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.invoiceTable}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th style={{ width: 60 }}>Tính chất</th>
              <th style={{ width: 90 }}>Loại hàng hoá đặc trưng</th>
              <th>Tên hàng hóa, dịch vụ</th>
              <th style={{ width: 70 }}>Đơn vị tính</th>
              <th style={{ width: 70 }}>Số lượng</th>
              <th className={styles.colFit}>Đơn giá</th>
              <th style={{ width: 80 }}>Chiết khấu</th>
              <th style={{ width: 70 }}>Thuế suất</th>
              <th className={styles.colFit} style={{ minWidth: 100 }}>Thành tiền chưa có thuế GTGT</th>
            </tr>
          </thead>
          <tbody>
            {listHoaDonDichVu.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 8 }}>Không có mặt hàng</td>
              </tr>
            ) : (
              listHoaDonDichVu.map((it, idx) => (
                <tr key={idx}>
                  <td className={styles.tc}>{idx + 1}</td>
                  <td className={styles.tl}>{formatTchat(it.tchat)}</td>
                  <td className={styles.tc}></td>
                  <td className={styles.tl}>{it.ten ?? it.description ?? ""}</td>
                  <td className={styles.tc}>{it.dvtinh ?? it.dvtte ?? ""}</td>
                  <td className={styles.tc}>{it.sluong ?? ""}</td>
                  <td className={`${styles.tc} ${styles.colFit}`}>{formatCurrency(it.dgia ?? 0)}</td>
                  <td className={styles.tc}>{it.stckhau != null ? formatCurrency(it.stckhau) : ""}</td>
                  <td className={styles.tc}>{it.ltsuat}</td>
                  <td className={`${styles.tc} ${styles.colFit}`}>{formatCurrency(it.thtien ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryLeftTableWrapper} style={(isSco && listThueSuat.length <= 0) ? { visibility: "hidden" } : undefined}>
          <table className={styles.summaryTableLeft}>
            <thead>
              <tr>
                <th>Thuế suất</th>
                <th>Tổng tiền chưa thuế</th>
                <th>Tổng tiền thuế</th>
              </tr>
            </thead>
            <tbody>
              {
                listThueSuat.map((it, idx) => (
                  <tr key={idx}>
                    <td className={styles.summaryCenter}>{it.tsuat ?? ""}</td>
                    <td className={styles.summaryRightAlign}>{formatCurrency(it.thtien ?? 0)}</td>
                    <td className={styles.summaryRightAlign}>{formatCurrency(it.tthue ?? 0)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        <div className={styles.summaryRightTableWrapper}>
          <table className={styles.summaryTableRight}>
            <tbody>
              {subtotal && (
              <tr>
                <td className={styles.summaryDescription}>
                  Tổng tiền chưa thuế<br />
                  <span className={styles.summaryNote}>(Tổng cộng thành tiền chưa có thuế)</span>
                </td>
                <td className={styles.summaryRightAlign}>{subtotal}</td>
              </tr>
              )}
              {tax && (
              <tr>
                <td className={styles.summaryDescription}>
                  Tổng tiền thuế<br />
                  <span className={styles.summaryNote}>(Tổng cộng tiền thuế)</span>
                </td>
                <td className={styles.summaryRightAlign}>{tax}</td>
              </tr>
              )}
              { (isSco && fee) || !isSco && (
              <tr>
                <td className={styles.summaryDescription}>Tổng tiền phí</td>
                <td className={styles.summaryRightAlign}>{fee}</td>
              </tr>
              )}
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
              {isSco && (
                <tr>
                  <td className={styles.summaryDescription}>Ghi chú</td>
                  <td className={styles.summaryRightAlign}></td>
                </tr>
              )}
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
          <div style={{ fontSize: "14px", fontStyle: "italic", marginBottom: "14px" }}>(Chữ ký điện tử, chữ ký số)</div>
          { nbcksInfo && nbcksInfo.cn && nbcksInfo.signingTime && (
            <div className={styles.signBox}>
              <div className={styles.signBoxLine}>Signature Valid</div>
              <div className={styles.signBoxLine}>Ký bởi {nbcksInfo.cn}</div>
              <div className={styles.signBoxLine}>Ký ngày: {nbcksInfo.signingTime}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</div>
      </div>
    </div>
  );
}