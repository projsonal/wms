import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Barang Keluar"
      breadcrumb="Laporan / Laporan Barang Keluar"
      reportPrefix="out"
    />
  );
}
