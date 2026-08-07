import { ReportPageTemplate } from '@/component/laporan/ReportPageTemplate';

export default function Page(): React.JSX.Element {
  return (
    <ReportPageTemplate
      title="Laporan Inventaris"
      breadcrumb="Laporan / Laporan Inventaris"
      reportPrefix="inv"
    />
  );
}
