import { UserManagementContent } from '@/component/content/UserManagement';
import { RoleGuard } from '@/component/layout/RoleGuard';

export default function Page(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <UserManagementContent />
    </RoleGuard>
  );
}
