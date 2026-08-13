'use client';

import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Download,
  Wrench,
  ShieldCheck,
  Printer,
  X,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useIsMobileDevice } from '@/lib/hooks/use-mobile-device';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRegisterPageActionFab } from '@/lib/hooks/use-page-fab';

export type TableRowAction = 'add' | 'change' | 'delete' | 'export' | 'modify' | 'protect' | 'print';

interface ActionDef {
  key: TableRowAction;
  label: string;
  icon: ReactNode;
}

const ACTIONS: ActionDef[] = [
  { key: 'add', label: 'Add', icon: <Plus className="h-3.5 w-3.5" /> },
  { key: 'change', label: 'Change', icon: <Pencil className="h-3.5 w-3.5" /> },
  { key: 'delete', label: 'Delete', icon: <Trash2 className="h-3.5 w-3.5" /> },
  { key: 'export', label: 'Export', icon: <Download className="h-3.5 w-3.5" /> },
  { key: 'print', label: 'Print', icon: <Printer className="h-3.5 w-3.5" /> },
  { key: 'modify', label: 'Modify', icon: <Wrench className="h-3.5 w-3.5" /> },
  { key: 'protect', label: 'Protect', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

/** Aksi yang TIDAK PERNAH digerbang matrix perizinan — backend menegakkan
 * keduanya lewat RequireRole (super_admin/admin saja), bukan lewat
 * RequirePermission per-module, jadi karyawan tidak akan pernah bisa
 * mendapat aksi ini walau di-toggle ON di matrix (backend tetap menolak). */
const ROLE_ONLY_ACTIONS = new Set<TableRowAction>(['delete', 'protect']);

interface TableRowActionBarProps {
  /** Dipanggil saat salah satu tombol aksi ditekan. Kalau tidak diisi,
   * tombol tetap tampil (mengikuti mockup) tapi tidak melakukan apa-apa —
   * pemanggil per halaman yang menentukan aksi sesungguhnya (mis. buka
   * modal tambah, konfirmasi hapus, dst). */
  onAction?: (action: TableRowAction) => void;
  /** Nonaktifkan tombol tertentu (mis. "delete" saat tidak ada baris terpilih). */
  disabledActions?: TableRowAction[];
  /** Batasi tombol yang MUNCUL sama sekali (bukan sekadar di-nonaktifkan) —
   * dipakai mis. di widget dashboard yang menggabungkan beberapa jenis
   * resource sekaligus, sehingga aksi Add/Change/Delete/Modify/Protect
   * yang terikat ke satu jenis resource tidak masuk akal ditampilkan.
   * Default: semua 7 aksi baku tampil (mengikuti mockup). */
  visibleActions?: TableRowAction[];
  /** Slug modul backend (mis. "kelola_barang") — kalau diisi, tombol
   * Add/Change/Modify/Print HANYA tampil sesuai matrix perizinan role user
   * yang login (dibaca lewat usePermissions), bukan cuma dari role
   * super_admin/admin. Delete & Protect tetap SELALU role-only (lihat
   * ROLE_ONLY_ACTIONS) karena backend memang begitu. Kalau TIDAK diisi,
   * perilaku lama dipertahankan penuh (toolbar hanya tampil untuk
   * super_admin/admin) supaya halaman lain yang belum di-migrasi tidak
   * berubah perilakunya. */
  module?: string;
  className?: string;
}

/**
 * Toolbar aksi tabel yang bisa digeser (scroll) ke kiri/kanan lewat tombol
 * chevron beranimasi, berisi aksi baku: Add, Change, Delete, Export, Print,
 * Modify, Protect — masing-masing beda fungsi.
 *
 * Tampil untuk super_admin/admin selalu (kompatibel dengan perilaku lama).
 * Untuk role lain (termasuk karyawan), toolbar HANYA tampil kalau prop
 * `module` diisi DAN role user yang login punya minimal satu izin yang
 * relevan di matrix (Settings > Perizinan Hak Akses User) — tombol yang
 * benar-benar tampil pun mengikuti izin per-aksi, bukan semua-atau-tidak.
 *
 * Di perangkat mobile (dideteksi lewat User-Agent, bukan lebar viewport),
 * toolbar berganti wujud jadi floating action button bulat mengambang di
 * pojok layar yang saat disentuh memekar jadi cincin tombol bulat kecil —
 * sesuai mockup Figma yang diberikan (lingkaran "+" -> lingkaran "×" +
 * cincin aksi).
 */
export function TableRowActionBar({
  onAction,
  disabledActions = [],
  visibleActions,
  module,
  className,
}: TableRowActionBarProps): React.JSX.Element | null {
  const { user } = useAuth();
  const isMobileDevice = useIsMobileDevice();
  const { can } = usePermissions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';

  function isActionAllowed(action: TableRowAction): boolean {
    if (isStaff) {
      return true;
    }
    if (!module || ROLE_ONLY_ACTIONS.has(action)) {
      return false;
    }
    if (action === 'export') {
      // Export cuma mengunduh apa yang sudah terlihat di layar (read-only)
      // — tidak butuh izin tambahan selama halamannya sendiri bisa diakses.
      return true;
    }
    if (action === 'add') return can(module, 'tambah');
    if (action === 'change' || action === 'modify') return can(module, 'edit');
    if (action === 'print') return can(module, 'print');
    return false;
  }

  const baseActions = visibleActions ? ACTIONS.filter((a) => visibleActions.includes(a.key)) : ACTIONS;
  const actions = baseActions.filter((a) => isActionAllowed(a.key));

  if (actions.length === 0) {
    return null;
  }

  if (isMobileDevice) {
    return <MobileFabActionMenu onAction={onAction} disabledActions={disabledActions} actions={actions} />;
  }

  function updateEdgeState(): void {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  function scrollBy(delta: number): void {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
    // Update tombol chevron sedikit setelah animasi smooth-scroll berjalan.
    window.setTimeout(updateEdgeState, 300);
  }

  return (
    <div className={className ?? 'flex flex-col gap-2'}>
      {/* Baris chevron navigasi, dipisah di atas strip tombol — meniru
          posisi persis pada mockup (chevron sendiri, lalu strip tombol). */}
      <div className="flex items-center gap-1 rounded-full border border-borderSoft bg-surfaceAlt p-1 self-start">
        <motion.button
          type="button"
          onClick={() => scrollBy(-160)}
          disabled={atStart}
          aria-label="Geser aksi ke kiri"
          whileHover={atStart ? undefined : { scale: 1.15, x: -2 }}
          whileTap={atStart ? undefined : { scale: 0.88 }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surface disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => scrollBy(160)}
          disabled={atEnd}
          aria-label="Geser aksi ke kanan"
          whileHover={atEnd ? undefined : { scale: 1.15, x: 2 }}
          whileTap={atEnd ? undefined : { scale: 0.88 }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-textMuted transition-colors hover:bg-surface disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.button>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateEdgeState}
        className="flex items-center gap-2 overflow-x-auto rounded-full border border-borderSoft bg-surfaceAlt px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {actions.map((action, index) => {
          const isDisabled = disabledActions.includes(action.key);
          return (
            <motion.button
              key={action.key}
              type="button"
              disabled={isDisabled}
              onClick={() => onAction?.(action.key)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              whileHover={isDisabled ? undefined : { scale: 1.06, y: -1 }}
              whileTap={isDisabled ? undefined : { scale: 0.94 }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-borderSoft bg-surface px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-accentDark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {action.icon}
              {action.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface MobileFabProps {
  onAction?: (action: TableRowAction) => void;
  disabledActions: TableRowAction[];
  actions: ActionDef[];
}

const RADIAL_RADIUS = 92;

/**
 * Floating action button bulat khusus mobile: lingkaran utama "+" yang
 * saat disentuh memekar jadi cincin 6 tombol bulat kecil tersebar
 * melingkar di sekelilingnya (mengikuti sudut -170°..-10°, membentuk
 * busur di atas tombol utama supaya tidak ketutupan jari saat disentuh),
 * lalu lingkaran utama berubah jadi "×" untuk menutup — persis pola pada
 * referensi Figma yang diberikan.
 */
function MobileFabActionMenu({ onAction, disabledActions, actions }: MobileFabProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  // Beritahu FAB navigasi global (MobileFloatingMenu) supaya sembunyi
  // selama FAB aksi tabel ini ada di layar — cegah dua tombol menumpuk.
  useRegisterPageActionFab(actions.length > 0);

  return (
    <>
      {/* Backdrop tipis saat terbuka, supaya sentuhan di luar cincin menutup menu. */}
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="fixed bottom-20 right-5 z-50">
        <div className="relative h-0 w-0">
          <AnimatePresence>
            {open
              ? actions.map((action, index) => {
                  // Sebar tombol di busur -170°..-10° (di atas tombol
                  // utama, membuka ke kiri-atas) supaya tetap terjangkau
                  // ibu jari saat FAB ada di pojok kanan bawah.
                  const angleDeg =
                    actions.length > 1 ? -170 + index * (160 / (actions.length - 1)) : -90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const x = Math.cos(angleRad) * RADIAL_RADIUS;
                  const y = Math.sin(angleRad) * RADIAL_RADIUS;
                  const isDisabled = disabledActions.includes(action.key);
                  return (
                    <motion.button
                      key={action.key}
                      type="button"
                      disabled={isDisabled}
                      aria-label={action.label}
                      title={action.label}
                      onClick={() => {
                        onAction?.(action.key);
                        setOpen(false);
                      }}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                      animate={{ opacity: 1, x, y, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: index * 0.03 }}
                      whileTap={isDisabled ? undefined : { scale: 0.9 }}
                      className="absolute flex h-11 w-11 items-center justify-center rounded-full border border-borderSoft bg-surface text-accentDark shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ left: 0, top: 0 }}
                    >
                      {action.icon}
                    </motion.button>
                  );
                })
              : null}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? 'Tutup menu aksi' : 'Buka menu aksi'}
            aria-expanded={open}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: open ? 135 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl"
            style={{ left: -28, top: -28 }}
          >
            {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.button>
        </div>
      </div>
    </>
  );
}
