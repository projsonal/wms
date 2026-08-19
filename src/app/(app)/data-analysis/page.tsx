import { DataAnalysisContent } from '@/component/content/DataAnalysis';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { STAFF_ROLES } from '@/auth/roles';

export default function Page(): React.JSX.Element {
  return <RoleGuard allowedRoles={STAFF_ROLES}><DataAnalysisContent /></RoleGuard>;
}
