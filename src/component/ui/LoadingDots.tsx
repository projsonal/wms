import { motion } from 'framer-motion';

interface LoadingDotsProps {

  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps): React.JSX.Element {
  return (
    <span className={className ?? 'flex items-center gap-1'} role="status" aria-label="Memproses...">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}
