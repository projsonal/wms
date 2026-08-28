import { Card } from '@/component/ui/Card';

interface MapPin {
  label: string;
  x: number;
  y: number;
  variant?: 'origin' | 'destination';
}

interface MapPlaceholderProps {
  title?: string;
  pins?: MapPin[];
  heightClassName?: string;
}

export function MapPlaceholder({
  title,
  pins = [],
  heightClassName = 'h-72',
}: MapPlaceholderProps): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-3 !p-0 overflow-hidden">
      {title ? <h2 className="px-5 pt-5 text-base font-semibold text-text">{title}</h2> : null}
      <div
        className={`relative w-full ${heightClassName} bg-[linear-gradient(0deg,rgba(179,71,31,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(179,71,31,0.08)_1px,transparent_1px)] bg-[size:28px_28px] bg-surfaceAlt`}
      >
        {pins.map((pin) => (
          <div
            key={pin.label}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-card ${
                pin.variant === 'destination' ? 'bg-dangerText' : 'bg-accent'
              }`}
            >
              📍
            </span>
            <span className="mt-1 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-text shadow-card">
              {pin.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
