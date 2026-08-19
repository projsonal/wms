import { StatusScreen } from '@/component/system/StatusScreen';

export default function NotFound(): React.JSX.Element {
  return (
    <StatusScreen
      code="404"
      actions={[
        { label: 'Kembali ke Dashboard', href: '/dashboard', variant: 'primary' },
        { label: 'Ke Halaman Login', href: '/login', variant: 'secondary' },
      ]}
    />
  );
}
