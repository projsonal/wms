import { StatCard } from '@/component/ui/StatCard';
import type { StatMetric } from '@/types';

interface StatsRowProps {
  stats: StatMetric[];
}

export function StatsRow({ stats }: StatsRowProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.id}
          label={stat.label}
          value={stat.value}
          helperText={stat.helperText}
        />
      ))}
    </div>
  );
}
