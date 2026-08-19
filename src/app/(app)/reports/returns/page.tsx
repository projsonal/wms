import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={STAFF_ROLES}>
      <ReportPageTemplate
        title="Laporan Barang Retur"
        breadcrumb="Laporan / Laporan Barang Retur"
        reportType="Barang Retur"
      />
    </RoleGuard>
  );
}
