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

const ROLE_ONLY_ACTIONS = new Set<TableRowAction>(['delete', 'protect']);

interface TableRowActionBarProps {

  onAction?: (action: TableRowAction) => void;

  disabledActions?: TableRowAction[];

  visibleActions?: TableRowAction[];

  module?: string;
  className?: string;
}

export function TableRowActionBar({
  onAction,
  disabledActions = [],
  visibleActions,
  module,
  className,
}: Readonly<TableRowActionBarProps>): React.JSX.Element | null {
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

    window.setTimeout(updateEdgeState, 300);
  }

  return (
    <div className={className ?? 'flex flex-col gap-2'}>

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

function MobileFabActionMenu({ onAction, disabledActions, actions }: Readonly<MobileFabProps>): React.JSX.Element {
  const [open, setOpen] = useState(false);

  useRegisterPageActionFab(actions.length > 0);

  return (
    <>

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

      <div className="fixed bottom-32 right-3 z-50 sm:right-20">

        <AnimatePresence>
          {open ? (
            <motion.div
              className="absolute bottom-full right-0 mb-3 grid grid-cols-2 gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {actions.map((action, index) => {
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
                    initial={{ opacity: 0, y: 12, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 24, delay: index * 0.025 }}
                    whileTap={isDisabled ? undefined : { scale: 0.9 }}
                    className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-2xl border border-borderSoft bg-surface text-accentDark shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {action.icon}
                  </motion.button>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Tutup menu aksi' : 'Buka menu aksi'}
          aria-expanded={open}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </motion.button>
      </div>
    </>
  );
}