import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Barang Masuk"
      breadcrumb="Laporan / Laporan Barang Masuk"
      reportPrefix="in"
    />
  );
}
