'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { Reveal } from '@/component/ui/Reveal';
import { AnimatedNumber } from '@/component/ui/AnimatedNumber';
import { fadeUp, popIn } from '@/component/ui/motion';

const QUICK_ACTIONS = [
  { label: 'Input Barang Masuk', href: '/goods-in' },
  { label: 'Input Barang Keluar', href: '/goods-out' },
  { label: 'Submit Stok Opname', href: '/inventory' },
  { label: 'Lihat Kelola Barang', href: '/items' },
];

const HANDLED_DELIVERIES = [
  { id: 'JX-88213', address: 'Jl. Merdeka No.9, Bandung', status: 'Dikirim' as const },
  { id: 'SC-40217', address: 'Toko Rahaja, Cimahi', status: 'Transit' as const },
  { id: 'AN-11290', address: 'Bank BSI, Bandung', status: 'Terkirim' as const },
];

const QUICK_STATS = [
  { label: 'Tugas hari ini', value: '5' },
  { label: 'Pickup & Dropoff terjadwal', value: '2' },
  { label: 'Pengiriman yang saya tangani', value: '3' },
  { label: 'Task selesai bulan ini', value: '28' },
];

const MY_TASKS = [
  {
    title: 'Packing Pesanan #1187',
    status: 'Status: Proses',
    due: 'Batas waktu: Hari ini, 15:00',
    priority: 'Prioritas Tinggi' as const,
  },
  {
    title: 'Input Barang Masuk IN-2344',
    status: 'Status: Menunggu verifikasi',
    due: 'Batas waktu: Hari ini, 17:00',
    priority: 'Normal' as const,
  },
  {
    title: 'Stock Opname Rak A1-R02',
    status: 'Status: Sudah dikirim ke Admin',
    due: 'Diselesaikan: Hari ini, 09:40',
    priority: 'Selesai' as const,
  },
];

const SCHEDULED_PICKUPS = [
  { code: 'PU-2202 • Pickup', place: 'PT. Internet Pratama, Bandung', status: 'Proses' as const },
  { code: 'DO-1188 • Dropoff', place: 'Toko Rahaja, Bandung', status: 'Terjadwal' as const },
];

const priorityVariant = {
  'Prioritas Tinggi': 'warning',
  Normal: 'info',
  Selesai: 'success',
} as const;

const deliveryVariant = {
  Dikirim: 'info',
  Transit: 'warning',
  Terkirim: 'success',
} as const;

export function KaryawanDashboard(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Reveal index={0}>
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text">Akses Cepat</h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action, index) => (
                <motion.div
                  key={action.href}
                  custom={index}
                  initial="hidden"
                  animate="show"
                  variants={popIn}
                >
                  <Link href={action.href}>
                    <Button className="w-full">{action.label}</Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal index={1}>
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Pengiriman yang Saya Tangani</h2>
                <p className="text-xs text-textMuted">Status real-time dari resi yang kamu proses</p>
              </div>
              <Link
                href="/delivery-monitoring"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Buka Monitoring Pengiriman
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {HANDLED_DELIVERIES.map((delivery, index) => (
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
                    <span className="font-semibold">{delivery.id}</span> • {delivery.address}
                  </span>
                  <Badge label={delivery.status} variant={deliveryVariant[delivery.status]} />
                </motion.li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {QUICK_STATS.map((stat, index) => (
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Reveal index={0}>
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-text">Tugas Saya Hari Ini</h2>
              <p className="text-xs text-textMuted">Ditugaskan oleh Admin / Super Admin</p>
            </div>
            <div className="flex flex-col gap-3">
              {MY_TASKS.map((task, index) => (
                <motion.div
                  key={task.title}
                  className="rounded-md border border-borderSoft bg-surfaceAlt p-4"
                  custom={index}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.6)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{task.title}</p>
                    <Badge label={task.priority} variant={priorityVariant[task.priority]} />
                  </div>
                  <p className="mt-1 text-xs text-textMuted">{task.status}</p>
                  <p className="text-xs text-textMuted">{task.due}</p>
                </motion.div>
              ))}
            </div>
            <Link
              href="/tasks"
              className="text-right text-xs font-semibold text-accent hover:underline"
            >
              Lihat semua tugas
            </Link>
          </Card>
        </Reveal>

        <Reveal index={1}>
          <Card className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-text">Pickup &amp; Dropoff Terjadwal</h2>
            <div className="flex flex-col gap-3">
              {SCHEDULED_PICKUPS.map((pickup, index) => (
                <motion.div
                  key={pickup.code}
                  className="rounded-md border border-borderSoft p-4"
                  custom={index}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  whileHover={{ x: 4 }}
                >
                  <p className="text-sm font-semibold text-text">{pickup.code}</p>
                  <p className="text-xs text-textMuted">{pickup.place}</p>
                  <Badge label={pickup.status} variant="warning" />
                </motion.div>
              ))}
            </div>
            <Link
              href="/pickup-dropoff"
              className="text-right text-xs font-semibold text-accent hover:underline"
            >
              Lihat semua jadwal
            </Link>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
