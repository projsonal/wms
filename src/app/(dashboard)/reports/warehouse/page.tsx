import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Gudang"
      breadcrumb="Laporan / Laporan Gudang"
      reportPrefix="wh"
    />
  );
}
