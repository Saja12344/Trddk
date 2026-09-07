"use client";

import { useMemo, useState } from "react";
import type { BulkImportPreview, BulkImportPreviewRow, BulkImportRow } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";

type Props = {
  businessId: string;
};

const ROLE_LABELS: Record<string, string> = {
  passenger: "راكب (Passenger)",
  driver: "سائق (Driver)",
  both: "كلاهما (Both)",
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
}

export function BulkEmployeeImport({ businessId }: Props) {
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [importRows, setImportRows] = useState<BulkImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const importableRows = useMemo(
    () =>
      preview?.preview.filter(
        (row) => row.validationStatus === "valid" && row.action !== "skip"
      ) ?? [],
    [preview]
  );

  const canConfirm = useMemo(
    () => Boolean(preview && importableRows.length > 0),
    [preview, importableRows]
  );

  async function handleFile(file: File) {
    setError("");
    setMessage("");
    setPreview(null);
    setImportRows([]);

    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (!headers.length) {
      setError("الملف فارغ أو غير مدعوم.");
      return;
    }

    setLoading(true);
    try {
      const data = await adminFetch<{ preview: BulkImportPreview; rows: BulkImportRow[] }>(
        "/api/users/bulk-import/preview",
        {
          method: "POST",
          body: JSON.stringify({ headers, rows, businessId }),
        }
      );
      setPreview(data.preview);
      setImportRows(data.rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    const rowsToImport = importRows.filter((row) =>
      importableRows.some((p) => p.email === row.email)
    );
    setLoading(true);
    setError("");
    try {
      const result = await adminFetch<{
        created: number;
        linked: number;
        updated: number;
        skipped: number;
        failed: number;
      }>("/api/users/bulk-import/confirm", {
        method: "POST",
        body: JSON.stringify({ businessId, rows: rowsToImport }),
      });
      setMessage(
        `تم: ${result.created} جديد، ${result.linked} مرتبط، ${result.updated} محدّث، ${result.skipped} متخطى، ${result.failed} فشل.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function displayRole(row: BulkImportPreviewRow) {
    return ROLE_LABELS[row.importRole ?? "passenger"] ?? row.importRole ?? "راكب";
  }

  return (
    <div className="card stack">
      <h3>استيراد مستفيدين (CSV)</h3>
      <p className="muted">
        يتم إنشاء كل مستفيد كعضو في الشركة مع تفعيل دور{" "}
        <strong>الراكب (Passenger)</strong> افتراضياً. عمود الدور اختياري — إن
        لم يُذكر يُعتمد راكب.
      </p>
      <p className="muted">
        الأعمدة المدعومة: الاسم / name، الإيميل / email، الدور / role. قيم الدور: passenger،
        driver، both، راكب، سائق، كلاهما. يدعم UTF-8 والنص العربي.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {loading && <p>جاري المعالجة...</p>}
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      {preview && (
        <>
          <ul className="muted">
            <li>إجمالي الصفوف: {preview.totalRows}</li>
            <li>صالحة: {preview.validRows}</li>
            <li>إيميلات غير صحيحة: {preview.invalidEmails}</li>
            <li>أدوار غير مدعومة: {preview.invalidRoles ?? 0}</li>
            <li>مكررة في الملف: {preview.duplicatesInFile}</li>
            <li>موجودون مسبقاً: {preview.existingUsers}</li>
            <li>ناقصة: {preview.missingRequired}</li>
          </ul>
          {preview.errors.length > 0 && (
            <ul className="alert alert-error">
              {preview.errors.slice(0, 20).map((err) => (
                <li key={err.rowNumber}>
                  صف {err.rowNumber}: {err.message}
                </li>
              ))}
            </ul>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>الإيميل</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>الإجراء</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.displayName}</td>
                  <td dir="ltr">{row.email}</td>
                  <td>{displayRole(row)}</td>
                  <td>{row.validationStatus === "valid" ? "✓" : "✗"}</td>
                  <td>
                    {row.action === "import"
                      ? "استيراد"
                      : row.action === "update"
                        ? "تحديث"
                        : "تخطي"}
                  </td>
                  <td>
                    {row.message ??
                      (row.existingInCompany
                        ? "موجود في الشركة"
                        : row.existingGlobally
                          ? "حساب عالمي موجود"
                          : "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canConfirm || loading}
            onClick={() => void handleConfirm()}
          >
            تأكيد الاستيراد ({importableRows.length})
          </button>
        </>
      )}
    </div>
  );
}
