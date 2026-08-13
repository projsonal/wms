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
import { barangRusakApi, deliveriesApi } from '@/lib/api/modules';
import { BARANG_RUSAK_STATUS_META, DELIVERY_STATUS_META } from '@/lib/utils/status';
import { listErrorMessage } from '@/lib/utils/errors';
import type { BarangRusak, Delivery } from '@/types';

const QUICK_ACTIONS = [
  { label: 'Input Barang Masuk', href: '/home/barang-masuk' },
  { label: 'Input Barang Keluar', href: '/home/barang-keluar' },
  { label: 'Submit Stok Opname', href: '/home/inventory' },
  { label: 'Lihat Kelola Barang', href: '/home/kelola-barang' },
];

/**
 * Semua data dashboard karyawan diambil di sini supaya komponen render
 * di bawah tetap sederhana (menghindari nested ternary & kompleksitas
 * tinggi di satu fungsi besar).
 */
function useKaryawanDashboardData() {
  const { user } = useAuth();

  // Backend GET /barang-rusak tidak memfilter per user — ambil semua lalu
  // saring laporan milik user login sendiri di sisi klien (field
  // dilaporkan_oleh berisi ID user, dicocokkan lewat user.id).
  const { data: barangRusakResult, error: barangRusakError, isLoading: barangRusakLoading } = useSWR(
    'karyawan-barang-rusak',
    () => barangRusakApi.list({ pageSize: 50 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const { data: barangRusakSummary, error: barangRusakSummaryError } = useSWR(
    'karyawan-barang-rusak-summary',
    () => barangRusakApi.summary(),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const myLaporanRusak = (barangRusakResult?.data ?? [])
    .filter((b) => !user || b.dilaporkanOleh === String(user.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  // Backend /pengiriman TIDAK punya kolom "ditangani oleh user ID" — kurir
  // cuma disimpan sebagai nama bebas (nama_kurir, bukan foreign key ke
  // tabel users). Jadi "pengiriman yang saya tangani" di sini adalah
  // pencocokan BEST-EFFORT nama kurir vs nama lengkap user yang login,
  // bukan filter presisi dari backend. Beri tahu saya kalau kamu mau
  // backend-nya ditambah kolom kurir_user_id supaya ini bisa akurat.
  const { data: deliveriesResult, error: deliveriesError, isLoading: deliveriesLoading } = useSWR(
    user ? ['karyawan-deliveries', user.fullName] : null,
    () => deliveriesApi.list({ pageSize: 100 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const allDeliveries = deliveriesResult?.data ?? [];
  const myDeliveries: Delivery[] = user
    ? allDeliveries.filter((d) => d.courierName.trim().toLowerCase() === user.fullName.trim().toLowerCase())
    : [];

  const handledDeliveries = myDeliveries
    .filter((d) => d.status === 'dijemput' || d.status === 'perjalanan')
    .slice(0, 3);

  const scheduledPickups = myDeliveries
    .filter((d) => d.status === 'menunggu' || d.status === 'dijemput')
    .slice(0, 3);

  const quickStats: { label: string; value: string }[] = [
    { label: 'Menunggu Pengecekan', value: barangRusakSummary ? String(barangRusakSummary.pengecekan) : '-' },
    { label: 'Pickup & Dropoff Terjadwal', value: String(scheduledPickups.length) },
    { label: 'Pengiriman yang Saya Tangani', value: String(handledDeliveries.length) },
    { label: 'Laporan Rusak Selesai Dicek', value: barangRusakSummary ? String(barangRusakSummary.retur + barangRusakSummary.rusak) : '-' },
  ];

  return {
    myLaporanRusak,
    barangRusakError,
    barangRusakLoading,
    barangRusakSummaryError,
    handledDeliveries,
    scheduledPickups,
    deliveriesError,
    deliveriesLoading,
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

interface HandledDeliveriesCardProps {
  deliveries: Delivery[];
  isLoading: boolean;
  errorMessage?: string;
}

function HandledDeliveriesCard({ deliveries, isLoading, errorMessage }: HandledDeliveriesCardProps): React.JSX.Element {
  let body: React.JSX.Element;
  if (isLoading) {
    body = <p className="text-xs text-textMuted">Memuat...</p>;
  } else if (errorMessage) {
    body = <p className="text-xs text-dangerText">{errorMessage}</p>;
  } else if (deliveries.length === 0) {
    body = <p className="text-xs text-textMuted">Belum ada pengiriman yang kamu tangani saat ini.</p>;
  } else {
    body = (
      <ul className="flex flex-col gap-3">
        {deliveries.map((delivery, index) => {
          const meta = DELIVERY_STATUS_META[delivery.status];
          return (
            <motion.li
              key={delivery.id}
              className="flex items-center justify-between text-sm"
              custom={index}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              whileHover={{ x: 4 }}
            >
              <span className="text-text">
                <span className="font-semibold">{delivery.code}</span> • {delivery.destination}
              </span>
              <Badge label={meta.label} variant={meta.variant} />
            </motion.li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">Pengiriman yang Saya Tangani</h2>
          <p className="text-xs text-textMuted">Status real-time dari resi yang kamu proses</p>
        </div>
        <Link href="/home/delivery-monitoring" className="text-xs font-semibold text-accent hover:underline">
          Buka Monitoring Pengiriman
        </Link>
      </div>
      {body}
    </Card>
  );
}

interface MyLaporanRusakCardProps {
  laporan: BarangRusak[];
  isLoading: boolean;
  errorMessage?: string;
}

function MyLaporanRusakCard({ laporan, isLoading, errorMessage }: MyLaporanRusakCardProps): React.JSX.Element {
  let body: React.JSX.Element;
  if (isLoading) {
    body = <p className="text-xs text-textMuted">Memuat...</p>;
  } else if (errorMessage) {
    body = <p className="text-xs text-dangerText">{errorMessage}</p>;
  } else if (laporan.length === 0) {
    body = <p className="text-xs text-textMuted">Belum ada laporan barang rusak yang kamu buat. 🎉</p>;
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
        <h2 className="text-base font-semibold text-text">Laporan Barang Rusak Saya</h2>
        <p className="text-xs text-textMuted">Status pengecekan terbaru dari laporan yang kamu buat</p>
      </div>
      {body}
      <Link href="/home/barang-rusak" className="text-right text-xs font-semibold text-accent hover:underline">
        Lihat semua laporan
      </Link>
    </Card>
  );
}

interface ScheduledPickupsCardProps {
  deliveries: Delivery[];
  isLoading: boolean;
}

function ScheduledPickupsCard({ deliveries, isLoading }: ScheduledPickupsCardProps): React.JSX.Element {
  let body: React.JSX.Element;
  if (isLoading) {
    body = <p className="text-xs text-textMuted">Memuat...</p>;
  } else if (deliveries.length === 0) {
    body = <p className="text-xs text-textMuted">Tidak ada pickup/dropoff terjadwal.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {deliveries.map((delivery, index) => {
          const meta = DELIVERY_STATUS_META[delivery.status];
          const jenisLabel = delivery.type === 'pickup' ? 'Pickup' : 'Dropoff';
          return (
            <motion.div
              key={delivery.id}
              className="rounded-md border border-borderSoft p-4"
              custom={index}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              whileHover={{ x: 4 }}
            >
              <p className="text-sm font-semibold text-text">
                {delivery.code} • {jenisLabel}
              </p>
              <p className="text-xs text-textMuted">{delivery.destination}</p>
              <Badge label={meta.label} variant={meta.variant} />
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Pickup &amp; Dropoff Terjadwal</h2>
      {body}
      <Link href="/home/pickup-dropoff" className="text-right text-xs font-semibold text-accent hover:underline">
        Lihat semua jadwal
      </Link>
    </Card>
  );
}

export function KaryawanDashboard(): React.JSX.Element {
  const data = useKaryawanDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Reveal index={0}>
          <QuickActionsCard />
        </Reveal>
        <Reveal index={1}>
          <HandledDeliveriesCard
            deliveries={data.handledDeliveries}
            isLoading={data.deliveriesLoading}
            errorMessage={listErrorMessage(data.deliveriesError)}
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Reveal index={0}>
          <MyLaporanRusakCard
            laporan={data.myLaporanRusak}
            isLoading={data.barangRusakLoading}
            errorMessage={listErrorMessage(data.barangRusakError)}
          />
        </Reveal>
        <Reveal index={1}>
          <ScheduledPickupsCard deliveries={data.scheduledPickups} isLoading={data.deliveriesLoading} />
        </Reveal>
      </div>
    </div>
  );
}
