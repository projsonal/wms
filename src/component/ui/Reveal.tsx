'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeUp, staggerContainer } from '@/component/ui/motion';

interface RevealProps {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: 'div' | 'li';
}

/**
 * Bungkus elemen apa pun supaya muncul dengan animasi fade + naik dari
 * bawah saat halaman/section pertama kali dirender. `index` dipakai untuk
 * memberi jeda (stagger) bila dipakai berulang dalam sebuah grid/list.
 */
export function Reveal({ children, index = 0, className, as = 'div' }: RevealProps): React.JSX.Element {
  const MotionTag = as === 'li' ? motion.li : motion.div;
  return (
    <MotionTag
      className={className}
      custom={index}
      initial="hidden"
      animate="show"
      variants={fadeUp}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
}

/** Kontainer stagger — anak-anak langsung yang memakai `variants={fadeUp}` akan muncul berurutan. */
export function StaggerGroup({ children, className }: StaggerGroupProps): React.JSX.Element {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={staggerContainer}>
      {children}
    </motion.div>
  );
}
