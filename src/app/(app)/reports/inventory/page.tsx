import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={STAFF_ROLES}>
      <ReportPageTemplate
        title="Laporan Inventaris"
        breadcrumb="Laporan / Laporan Inventaris"
        reportType="Stok Barang"

        hasDateGranularity={false}
      />
    </RoleGuard>
  );
}
