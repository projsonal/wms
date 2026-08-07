'use client';

import { motion } from 'framer-motion';
import { Card } from '@/component/ui/Card';
import { fadeUp, springSoft } from '@/component/ui/motion';

export interface ProgressRow {
  label: string;
  value: string;
  percent: number;
  color: string;
}

interface ProgressListCardProps {
  title: string;
  subtitle?: string;
  rows: ProgressRow[];
}

export function ProgressListCard({ title, subtitle, rows }: ProgressListCardProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {subtitle ? <p className="text-xs text-textMuted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <motion.div
            key={row.label}
            className="flex flex-col gap-1.5"
            custom={index}
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-textMuted">{row.label}</span>
              <span className="font-semibold text-text">{row.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surfaceAlt">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, row.percent)}%` }}
                transition={{ ...springSoft, delay: 0.15 + index * 0.08, duration: 0.9 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
