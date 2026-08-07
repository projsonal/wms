'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Card } from '@/component/ui/Card';
import { AnimatedNumber } from '@/component/ui/AnimatedNumber';
import { fadeUp, popIn, springSnappy } from '@/component/ui/motion';

interface StatCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  index?: number;
}

export function StatCard({
  label,
  value,
  helperText,
  icon,
  trend,
  index = 0,
}: StatCardProps): React.JSX.Element {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="show"
      variants={fadeUp}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={springSnappy}
      className="group"
    >
      <Card className="relative flex flex-col gap-3 overflow-hidden transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgba(179,71,31,0.16)]">
        <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-accentSoft/0 transition-colors duration-500 group-hover:bg-accentSoft/60" />
        {trend ? (
          <motion.span
            custom={index + 1}
            variants={popIn}
            initial="hidden"
            animate="show"
            className={clsx(
              'absolute right-4 top-4 rounded-full px-2 py-0.5 text-xs font-semibold',
              trend.positive ? 'bg-successBg text-successText' : 'bg-dangerBg text-dangerText',
            )}
          >
            {trend.positive ? '+' : ''}
            {trend.value}
          </motion.span>
        ) : null}
        {icon ? (
          <motion.span
            whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surfaceAlt text-accent"
          >
            {icon}
          </motion.span>
        ) : null}
        <div className="relative z-10">
          <p className="text-2xl font-bold text-text">
            <AnimatedNumber value={value} />
          </p>
          <p className="text-sm text-textMuted">{label}</p>
          {helperText ? <p className="mt-1 text-xs text-textMuted">{helperText}</p> : null}
        </div>
      </Card>
    </motion.div>
  );
}
