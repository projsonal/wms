import { SupplierContent } from '@/component/content/Supplier';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return <RoleGuard allowedRoles={STAFF_ROLES}><SupplierContent /></RoleGuard>;
}
