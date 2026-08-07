'use client';

import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/component/ui/Card';
import { fadeUp } from '@/component/ui/motion';
import type { DonutSegment } from '@/types';

interface DonutChartCardProps {
  title: string;
  subtitle?: string;
  data: DonutSegment[];
}

export function DonutChartCard({ title, subtitle, data }: DonutChartCardProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {subtitle ? <p className="text-xs text-textMuted">{subtitle}</p> : null}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              isAnimationActive
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((segment) => (
                <Cell key={segment.label} fill={segment.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #f0dad2', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {data.map((segment, index) => (
          <motion.li
            key={segment.label}
            className="flex items-center justify-between"
            custom={index}
            initial="hidden"
            animate="show"
            variants={fadeUp}
          >
            <span className="flex items-center gap-2 text-textMuted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </span>
            <span className="font-semibold text-text">{segment.value}</span>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}
