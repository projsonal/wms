'use client';

import { motion } from 'framer-motion';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/component/ui/Card';
import { popIn } from '@/component/ui/motion';
import type { TrendPoint } from '@/types';

interface TrendChartCardProps {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
}

export function TrendChartCard({
  title,
  subtitle,
  data,
  primaryLabel,
  secondaryLabel,
}: TrendChartCardProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {subtitle ? <p className="text-xs text-textMuted">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-4 text-xs text-textMuted">
          <motion.span
            className="flex items-center gap-1.5"
            custom={0}
            initial="hidden"
            animate="show"
            variants={popIn}
          >
            <span className="h-2 w-2 rounded-full bg-accent" /> {primaryLabel}
          </motion.span>
          {secondaryLabel ? (
            <motion.span
              className="flex items-center gap-1.5"
              custom={1}
              initial="hidden"
              animate="show"
              variants={popIn}
            >
              <span className="h-2 w-2 rounded-full bg-infoText" /> {secondaryLabel}
            </motion.span>
          ) : null}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#8a7b74' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 12, fill: '#8a7b74' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #f0dad2', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#b3471f"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#b3471f' }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={1400}
              animationEasing="ease-out"
            />
            {secondaryLabel ? (
              <Line
                type="monotone"
                dataKey="secondaryValue"
                stroke="#3454c7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3454c7' }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
                animationBegin={200}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
