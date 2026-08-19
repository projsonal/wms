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
        // Chart Stok Barang adalah snapshot "Top 10 Stok Terbanyak" (bukan
        // deret waktu harian/bulanan/tahunan) — lihat computeTopStokChart
        // di backend, internal/controller/laporan/chart.go.
        hasDateGranularity={false}
      />
    </RoleGuard>
  );
}
