import { WarehouseManagementContent } from '@/component/gudang/WarehouseManagement';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return <RoleGuard allowedRoles={STAFF_ROLES}><WarehouseManagementContent /></RoleGuard>;
}
