'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/component/ui/Badge';
import { Card } from '@/component/ui/Card';
import { DELIVERY_STATUS_META } from '@/lib/utils/status';
import { fadeUp } from '@/component/ui/motion';
import type { Delivery } from '@/types';

interface DeliveryTrackingCardProps {
  deliveries: Delivery[];
  errorMessage?: string;
}

export function DeliveryTrackingCard({ deliveries, errorMessage }: DeliveryTrackingCardProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Lacak Pengiriman</h2>
      {errorMessage ? (
        <p className="text-xs text-dangerText">{errorMessage}</p>
      ) : deliveries.length === 0 ? (
        <p className="text-xs text-textMuted">Belum ada pengiriman berjalan.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {deliveries.map((delivery, index) => {
            const meta = DELIVERY_STATUS_META[delivery.status];
            return (
              <motion.li
                key={delivery.id}
                className="flex items-center justify-between gap-2 rounded-md transition-colors hover:bg-surfaceAlt"
                custom={index}
                initial="hidden"
                animate="show"
                variants={fadeUp}
                whileHover={{ x: 4 }}
              >
                <div>
                  <p className="text-sm font-semibold text-text">{delivery.code}</p>
                  <p className="text-xs text-textMuted">{delivery.destination}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/delivery/${delivery.id}`}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Lihat detail
                  </Link>
                  <Badge label={meta.label} variant={meta.variant} />
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
