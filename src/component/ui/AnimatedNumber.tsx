'use client';

import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: string | number;
  duration?: number;
}

export function AnimatedNumber({ value, duration = 1.1 }: AnimatedNumberProps): React.JSX.Element {
  const raw = String(value);
  const match = raw.match(/-?\d[\d.,]*/);
  const spanRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);

  const numeric = match ? Number(match[0].replace(/[.,]/g, '')) : null;
  const prefix = match ? raw.slice(0, match.index) : '';
  const suffix = match ? raw.slice((match.index ?? 0) + match[0].length) : '';
  const hasThousandSep = match ? /[.,]/.test(match[0]) : false;

  const display = useTransform(motionValue, (latest) => {
    const rounded = Math.round(latest);
    return hasThousandSep ? rounded.toLocaleString('id-ID') : String(rounded);
  });

  useEffect(() => {
    if (numeric === null) {
      return;
    }
    const controls = animate(motionValue, numeric, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric]);

  useEffect(() => {
    if (numeric === null || !spanRef.current) {
      return;
    }
    return display.on('change', (v) => {
      if (spanRef.current) {
        spanRef.current.textContent = v;
      }
    });
  }, [display, numeric]);

  if (numeric === null) {
    return <>{raw}</>;
  }

  return (
    <>
      {prefix}
      <span ref={spanRef}>0</span>
      {suffix}
    </>
  );
}
