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

export function DeliveryTrackingCard({ deliveries, errorMessage }: Readonly<DeliveryTrackingCardProps>): React.JSX.Element {
  let content: React.JSX.Element;

  if (errorMessage) {
    content = <p className="text-xs text-dangerText">{errorMessage}</p>;
  } else if (deliveries.length === 0) {
    content = <p className="text-xs text-textMuted">Belum ada pengiriman berjalan.</p>;
  } else {
    content = (
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
                  href={`/(app)/delivery/${delivery.id}`}
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
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Lacak Pengiriman</h2>
      {content}
    </Card>
  );
}
