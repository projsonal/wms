'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PageShell } from '@/component/layout/PageShell';
import { SuperAdminDashboard } from '@/component/roles_dashboard/super_admin';
import { AdminDashboard } from '@/component/roles_dashboard/admin';
import { KaryawanDashboard } from '@/component/roles_dashboard/karyawan';
import { WelcomeBanner } from '@/component/dashboard/WelcomeBanner';
import { WelcomeTransition } from '@/component/auth/WelcomeTransition';
import { showLoginGuide } from '@/component/system/LoginGuide';
import { useAuth } from '@/auth/AuthContext';
import { ROLE_LABEL } from '@/auth/roles';

const WELCOME_FLAG_KEY = 'wms_show_welcome';

export default function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();
  const role = user?.role ?? 'karyawan';
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.sessionStorage.getItem(WELCOME_FLAG_KEY) === '1') {
      window.sessionStorage.removeItem(WELCOME_FLAG_KEY);

      setShowSplash(true);
    }
  }, []);

  return (
    <PageShell title="Dashboard" breadcrumb="Menu Utama / Dashboard">
      <AnimatePresence>
        {showSplash && user ? (
          <WelcomeTransition
            name={user.fullName.split(' ')[0] ?? user.fullName}
            roleLabel={ROLE_LABEL[user.role]}
            onDone={() => {
              setShowSplash(false);

              showLoginGuide(user.role);
            }}
          />
        ) : null}
      </AnimatePresence>

      {user ? <WelcomeBanner fullName={user.fullName} role={user.role} /> : null}

      {role === 'super_admin' ? <SuperAdminDashboard /> : null}
      {role === 'admin' ? <AdminDashboard /> : null}
      {role === 'karyawan' ? <KaryawanDashboard /> : null}
    </PageShell>
  );
}
