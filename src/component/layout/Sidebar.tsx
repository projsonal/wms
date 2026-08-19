'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ChevronsLeft, ChevronsRight, Settings } from 'lucide-react';
import { getNavGroupsForRole, ROLE_LABEL } from '@/auth/roles';
import { useAuth } from '@/auth/AuthContext';
import { useSidebarState } from '@/component/layout/SidebarContext';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthedImage } from '@/lib/hooks/useAuthedImage';

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 76;

/**
 * Isi sidebar (logo, nav, kartu profil) — dipakai ulang oleh mode desktop
 * (sticky, bisa diciutkan) dan mode mobile (drawer overlay penuh).
 */
function SidebarBody({
  collapsed,
  onNavigate,
}: Readonly<{
  collapsed: boolean;
  onNavigate?: () => void;
}>): React.JSX.Element {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations();
  const role = user?.role ?? 'karyawan';
  const navGroups = getNavGroupsForRole(role);
  const avatarUrl = useAuthedImage(user?.avatarUrl);

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden px-3 py-6">
      <div>
        <motion.div
          className={clsx('mb-6 flex items-center gap-2 px-2', collapsed && 'justify-center px-0')}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <motion.div whileHover={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 0.5 }}>
            <Image src="/assets/icon_wms_square.png" alt="" width={32} height={32} className="shrink-0 rounded-lg object-cover" />
          </motion.div>
          {collapsed ? null : <h1 className="truncate text-xl font-bold">{ROLE_LABEL[role]}</h1>}
        </motion.div>
        <nav className="flex flex-col gap-5">
          {navGroups.map((group, groupIndex) => (
            <div key={group.title ?? group.links[0]?.href}>
              {group.title && !collapsed ? (
                <motion.p
                  className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-white/50"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + groupIndex * 0.05 }}
                >
                  {group.title}
                </motion.p>
              ) : null}
              <div className="flex flex-col gap-1">
                {group.links.map((link, linkIndex) => {
                  const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.12 + groupIndex * 0.05 + linkIndex * 0.03,
                        type: 'spring',
                        stiffness: 260,
                        damping: 24,
                      }}
                    >
                      <Link
                        href={link.href}
                        onClick={onNavigate}
                        title={collapsed ? link.label : undefined}
                        className={clsx(
                          'relative flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
                          collapsed && 'justify-center px-0 py-2.5',
                          isActive ? 'text-white' : 'text-white/80 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        {isActive ? (
                          <motion.span
                            layoutId="sidebar-active-pill"
                            className={clsx('absolute rounded-full bg-accent', collapsed ? 'inset-1' : 'inset-0')}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          />
                        ) : null}
                        {collapsed ? (
                          <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                            {link.label.charAt(0)}
                          </span>
                        ) : (
                          <span className="relative z-10 truncate">{link.label}</span>
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {/* Setting — tersedia untuk SEMUA role. Diletakkan sebagai item
            terakhir daftar nav (di atas kartu profil/Logout), persis
            seperti posisinya di mockup: baris penuh dengan aksen border
            kiri saat aktif, terpisah sedikit dari grup Laporan di atasnya. */}
        <div className="mt-4 border-t border-white/10 pt-3">
          <Link
            href="/(app)/settings"
            onClick={onNavigate}
            title={collapsed ? 'Settings' : undefined}
            className={clsx(
              'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0 py-2.5',
              pathname === '/(app)/settings' || pathname.startsWith('/(app)/settings/')
                ? 'bg-accent text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span className="truncate">{t('sidebar.settings')}</span>}
          </Link>
        </div>
      </div>

      <motion.div
        className={clsx(
          'flex items-center gap-3 rounded-lg bg-white/10 p-3',
          collapsed && 'flex-col gap-2 p-2',
        )}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Klik avatar/nama -> Settings (sama seperti link Settings di atas,
            ditaruh di sini juga karena ini area yang biasa diklik user untuk
            "buka pengaturan akun saya"). Tombol Logout di dalamnya SENGAJA
            memanggil stopPropagation supaya klik Logout tidak ikut memicu
            navigasi ke Settings. */}
        <Link
          href="/(app)/settings"
          onClick={onNavigate}
          title={collapsed ? t('sidebar.settings') : undefined}
          className={clsx(
            'flex flex-1 items-center gap-3 rounded-lg text-left transition-opacity hover:opacity-80',
            collapsed && 'flex-col gap-2',
          )}
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutralBg">
            <span className="absolute inset-0 rounded-full animate-wms-glow-pulse" />
            {/* eslint-disable-next-line @next/next/no-img-element -- avatarUrl dari domain backend terpisah; default-avatar.png aset statis lokal, keduanya butuh <img> polos */}
            <img
              src={avatarUrl ?? '/assets/default-avatar.png'}
              alt=""
              className="relative h-full w-full rounded-full object-cover"
            />
          </span>
          {collapsed ? null : (
            <span className="flex-1 truncate text-sm font-semibold">{user?.fullName ?? 'Pengguna'}</span>
          )}
        </Link>
        {collapsed ? (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              logout();
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            title={t('sidebar.logout')}
            className="rounded-full border border-white/30 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
          >
            Keluar
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              logout();
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="shrink-0 rounded-full border border-white/30 px-3 py-1 text-left text-xs text-white/80 hover:bg-white/10"
          >
            {t('sidebar.logout')}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

/** Sidebar desktop: sticky penuh tinggi layar, bisa diciutkan jadi mode ikon. */
export function Sidebar(): React.JSX.Element {
  const { isCollapsed, toggleCollapsed, isMobileOpen, closeMobile } = useSidebarState();

  return (
    <>
      {/* Desktop: sticky di sisi kiri, ikut scroll, tinggi selalu penuh layar. */}
      <motion.aside
        animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        className="sticky top-0 hidden h-screen shrink-0 bg-gradient-to-b from-sidebarFrom to-sidebarTo text-white lg:block print:hidden"
      >
        <span className="pointer-events-none absolute -right-6 top-24 h-16 w-16 rotate-12 rounded-lg border border-white/10 animate-wms-float-slow" />
        <span className="pointer-events-none absolute -left-4 bottom-40 h-10 w-10 -rotate-6 rounded-md border border-white/10 animate-wms-float" />
        <SidebarBody collapsed={isCollapsed} />
        <motion.button
          type="button"
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          aria-label={isCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          className="absolute -right-3 top-8 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-accent text-white shadow-card"
        >
          {isCollapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </motion.button>
      </motion.aside>

      {/* Mobile: drawer overlay penuh dengan backdrop, dipicu tombol hamburger di Header. */}
      <AnimatePresence>
        {isMobileOpen ? (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
            />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-sidebarFrom to-sidebarTo text-white lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            >
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Tutup menu"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarBody collapsed={false} onNavigate={closeMobile} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** Tombol hamburger untuk membuka drawer sidebar di layar kecil — dipasang di Header. */
export function SidebarMobileToggle(): React.JSX.Element {
  const { openMobile } = useSidebarState();
  return (
    <motion.button
      type="button"
      onClick={openMobile}
      whileTap={{ scale: 0.9 }}
      aria-label="Buka menu"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft text-text hover:bg-surfaceAlt lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </motion.button>
  );
}
