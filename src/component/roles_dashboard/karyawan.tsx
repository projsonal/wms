'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { Reveal } from '@/component/ui/Reveal';
import { AnimatedNumber } from '@/component/ui/AnimatedNumber';
import { fadeUp, popIn } from '@/component/ui/motion';
import { useAuth } from '@/auth/AuthContext';
import { barangRusakApi } from '@/lib/api/modules';
import { BARANG_RUSAK_STATUS_META } from '@/lib/utils/status';
import { listErrorMessage } from '@/lib/utils/errors';
import type { BarangRusak } from '@/types';

const QUICK_ACTIONS = [
  { label: 'Input Barang Masuk', href: '/barang-masuk' },
  { label: 'Input Barang Keluar', href: '/barang-keluar' },
  { label: 'Submit Stok Opname', href: '/inventory' },
  { label: 'Lihat Kelola Barang', href: '/kelola-barang' },
];

function useKaryawanDashboardData() {
  const { user } = useAuth();

  const { data: barangRusakResult, error: barangRusakError, isLoading: barangRusakLoading } = useSWR(
    'karyawan-barang-rusak',
    () => barangRusakApi.list({ pageSize: 50 }),
    { revalidateOnFocus: true, shouldRetryOnError: false },
  );
  const { data: barangRusakSummary, error: barangRusakSummaryError } = useSWR(
    'karyawan-barang-rusak-summary',
    () => barangRusakApi.summary(),
    { revalidateOnFocus: true, shouldRetryOnError: false },
  );

  const allMyLaporanRusak = (barangRusakResult?.data ?? []).filter(
    (b) => !user || b.dilaporkanOleh === String(user.id),
  );
  const myLaporanRusak = [...allMyLaporanRusak]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  const quickStats: { label: string; value: string }[] = [
    { label: 'Menunggu Pengecekan', value: barangRusakSummary ? String(barangRusakSummary.pengecekan) : '-' },
    { label: 'Laporan Rusak Selesai Dicek', value: barangRusakSummary ? String(barangRusakSummary.retur + barangRusakSummary.rusak) : '-' },
    { label: 'Total Laporan Saya', value: String(allMyLaporanRusak.length) },
  ];

  return {
    myLaporanRusak,
    barangRusakError,
    barangRusakLoading,
    barangRusakSummaryError,
    quickStats,
  };
}

function QuickActionsCard(): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Akses Cepat</h2>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action, index) => (
          <motion.div key={action.href} custom={index} initial="hidden" animate="show" variants={popIn}>
            <Link href={action.href}>
              <Button className="w-full">{action.label}</Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

interface MyLaporanRusakCardProps {
  laporan: BarangRusak[];
  isLoading: boolean;
  errorMessage?: string;
}

function MyLaporanRusakCard({ laporan, isLoading, errorMessage }: Readonly <MyLaporanRusakCardProps>): React.JSX.Element {
  let body: React.JSX.Element;
  if (isLoading) {
    body = <p className="text-xs text-textMuted">Memuat...</p>;
  } else if (errorMessage) {
    body = <p className="text-xs text-dangerText">{errorMessage}</p>;
  } else if (laporan.length === 0) {
    body = <p className="text-xs text-textMuted">Belum ada laporan barang rusak yang kamu buat.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {laporan.map((item, index) => {
          const statusMeta = BARANG_RUSAK_STATUS_META[item.status];
          return (
            <motion.div
              key={item.id}
              className="rounded-md border border-borderSoft bg-surfaceAlt p-4"
              custom={index}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.6)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">{item.namaBarang}</p>
                <Badge label={statusMeta.label} variant={statusMeta.variant} />
              </div>
              <p className="mt-1 text-xs text-textMuted">Label: {item.labelBarang}</p>
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Laporan Barang Rusak</h2>
        <p className="text-xs text-textMuted">Status pengecekan terbaru dari laporan yang kamu buat</p>
      </div>
      {body}
      <Link href="/barang-rusak" className="text-right text-xs font-semibold text-accent hover:underline">
        Lihat semua laporan
      </Link>
    </Card>
  );
}

export function KaryawanDashboard(): React.JSX.Element {
  const data = useKaryawanDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <Reveal index={0}>
        <QuickActionsCard />
      </Reveal>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {data.quickStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            custom={index}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            whileHover={{ y: -4, scale: 1.02 }}
          >
            <Card className="flex flex-col gap-1">
              <p className="text-xs text-textMuted">{stat.label}</p>
              <p className="text-2xl font-bold text-text">
                <AnimatedNumber value={stat.value} />
              </p>
            </Card>
          </motion.div>
        ))}
      </div>
      {data.barangRusakSummaryError ? (
        <p className="-mt-3 text-xs text-dangerText">{listErrorMessage(data.barangRusakSummaryError)}</p>
      ) : null}

      <Reveal index={0}>
        <MyLaporanRusakCard
          laporan={data.myLaporanRusak}
          isLoading={data.barangRusakLoading}
          errorMessage={listErrorMessage(data.barangRusakError)}
        />
      </Reveal>
    </div>
  );
}
