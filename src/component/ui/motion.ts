import type { Transition, Variants } from 'framer-motion';

/** Transisi pegas standar — dipakai untuk elemen yang butuh kesan "hidup". */
export const springSnappy: Transition = { type: 'spring', stiffness: 260, damping: 22 };
export const springSoft: Transition = { type: 'spring', stiffness: 140, damping: 18 };

/** Fade + naik dari bawah. Cocok untuk kartu, section, baris tabel. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...springSoft, delay: i * 0.06 },
  }),
};

/** Fade + scale kecil, untuk elemen "muncul" seperti badge, icon bulat. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { ...springSnappy, delay: i * 0.05 },
  }),
};

/** Container stagger generik — pasangkan dengan fadeUp/popIn pada anak. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Slide dari kiri, untuk elemen yang "masuk" seperti forklift / list item. */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { ...springSoft, delay: i * 0.07 },
  }),
};
