import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={STAFF_ROLES}>
      <ReportPageTemplate
        title="Laporan Pengajuan Barang"
        breadcrumb="Laporan / Laporan Pengajuan Barang"
        reportType="Pengajuan Barang"
      />
    </RoleGuard>
  );
}
