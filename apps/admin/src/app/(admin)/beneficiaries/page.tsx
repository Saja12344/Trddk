"use client";

import Link from "next/link";
import { useState } from "react";
import { AddBeneficiaryForm } from "@/components/AddBeneficiaryForm";
import { BulkEmployeeImport } from "@/components/BulkEmployeeImport";
import { BusinessEmployeesPanel } from "@/components/BusinessEmployeesPanel";
import { useAuth } from "@/components/AuthProvider";
import { isSuperAdmin } from "@/lib/auth.constants";
import { useEffectiveBusinessId } from "@/hooks/useEffectiveBusinessId";

export default function BeneficiariesPage() {
  const { user } = useAuth();
  const businessId = useEffectiveBusinessId();
  const [listKey, setListKey] = useState(0);

  return (
    <>
      <div className="page-header">
        <h1>المستفيدين</h1>
        <p>
          سجّل الركاب والسائقين ومدير الشركة من هنا. التعديل يغيّر رقم الجوال
          والدور، والتعطيل أو الحذف من نفس الصف.
        </p>
      </div>

      {!businessId && (
        <div className="alert alert-info card mb-20">
          {isSuperAdmin(user) ? (
            <>
              اختر شركة من القائمة الجانبية («الشركة النشطة») ثم أضف المستفيدين
              لها. أو افتح{" "}
              <Link href="/businesses">صفحة الشركات</Link> واختر شركة.
            </>
          ) : (
            <>تعذر تحديد الشركة. تواصل مع مدير النظام.</>
          )}
        </div>
      )}

      {businessId && (
        <div className="stack">
          <AddBeneficiaryForm
            businessId={businessId}
            onAdded={() => setListKey((k) => k + 1)}
          />
          <BusinessEmployeesPanel key={listKey} businessId={businessId} />
          <BulkEmployeeImport businessId={businessId} />
        </div>
      )}
    </>
  );
}
