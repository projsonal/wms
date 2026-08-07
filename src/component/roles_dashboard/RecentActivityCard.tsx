'use client';

import { motion } from 'framer-motion';
import { Card } from '@/component/ui/Card';
import { fadeUp } from '@/component/ui/motion';

export interface ActivityItem {
  id: string;
  message: string;
  timeAgo: string;
}

interface RecentActivityCardProps {
  items: ActivityItem[];
}

export function RecentActivityCard({ items }: RecentActivityCardProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Aktivitas Terbaru</h2>
      <ul className="flex flex-col gap-4">
        {items.map((item, index) => (
          <motion.li
            key={item.id}
            className="flex gap-2 text-sm"
            custom={index}
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <motion.span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
            />
            <div>
              <p className="text-text">{item.message}</p>
              <p className="text-xs text-textMuted">{item.timeAgo}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}
