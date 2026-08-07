import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Barang Retur"
      breadcrumb="Laporan / Laporan Barang Retur"
      reportPrefix="ret"
    />
  );
}
