import type { SVGProps } from 'react';

/**
 * Ikon-ikon SVG ringan bertema pergudangan & inventaris (kotak, forklift,
 * pallet, rak, barcode) — dipakai di WelcomeTransition & WelcomeBanner
 * supaya tidak bergantung pada aset gambar eksternal.
 */

export function BoxIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M24 4 44 14v20L24 44 4 34V14L24 4Z" fill="currentColor" fillOpacity="0.18" />
      <path d="M24 4 44 14 24 24 4 14 24 4Z" fill="currentColor" fillOpacity="0.32" />
      <path d="M24 24v20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
      <path d="M4 14v20l20 10V24L4 14Z" fill="currentColor" fillOpacity="0.24" />
      <path d="M44 14v20L24 44V24l20-10Z" fill="currentColor" fillOpacity="0.14" />
    </svg>
  );
}

export function PalletIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="2" width="60" height="6" rx="1.5" fill="currentColor" fillOpacity="0.5" />
      <rect x="6" y="10" width="6" height="12" rx="1" fill="currentColor" fillOpacity="0.35" />
      <rect x="29" y="10" width="6" height="12" rx="1" fill="currentColor" fillOpacity="0.35" />
      <rect x="52" y="10" width="6" height="12" rx="1" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

export function ForkliftIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="40" y="4" width="26" height="22" rx="3" fill="currentColor" fillOpacity="0.85" />
      <rect x="44" y="8" width="18" height="9" rx="1.5" fill="white" fillOpacity="0.35" />
      <path d="M66 12h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H66V12Z" fill="currentColor" fillOpacity="0.6" />
      <rect x="12" y="24" width="4" height="24" fill="currentColor" fillOpacity="0.9" />
      <rect x="4" y="26" width="24" height="5" rx="1.5" fill="currentColor" />
      <rect x="4" y="36" width="24" height="5" rx="1.5" fill="currentColor" />
      <rect x="28" y="20" width="12" height="26" rx="2" fill="currentColor" fillOpacity="0.7" />
      <circle cx="30" cy="50" r="6" fill="currentColor" />
      <circle cx="30" cy="50" r="2.4" fill="white" fillOpacity="0.6" />
      <circle cx="70" cy="50" r="6" fill="currentColor" />
      <circle cx="70" cy="50" r="2.4" fill="white" fillOpacity="0.6" />
      <rect x="38" y="42" width="30" height="6" rx="2" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
}

export function ShelfIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="2" width="4" height="44" fill="currentColor" fillOpacity="0.5" />
      <rect x="34" y="2" width="4" height="44" fill="currentColor" fillOpacity="0.5" />
      <rect x="2" y="4" width="36" height="3" fill="currentColor" fillOpacity="0.5" />
      <rect x="2" y="22" width="36" height="3" fill="currentColor" fillOpacity="0.5" />
      <rect x="2" y="41" width="36" height="3" fill="currentColor" fillOpacity="0.5" />
      <rect x="7" y="8" width="9" height="9" rx="1.5" fill="currentColor" fillOpacity="0.3" />
      <rect x="19" y="9" width="8" height="8" rx="1.5" fill="currentColor" fillOpacity="0.35" />
      <rect x="7" y="27" width="8" height="9" rx="1.5" fill="currentColor" fillOpacity="0.35" />
      <rect x="20" y="26" width="9" height="10" rx="1.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

export function BarcodeIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {[2, 6, 9, 15, 19, 22, 28, 33, 37, 41, 46, 50, 55, 59].map((x, i) => (
        <rect key={x} x={x} y="2" width={i % 3 === 0 ? 3 : 1.6} height="28" fill="currentColor" />
      ))}
    </svg>
  );
}

export function CheckBurstIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.14" />
      <circle cx="32" cy="32" r="22" fill="currentColor" fillOpacity="0.22" />
      <path
        d="M20 33.5 27.5 41 44 24"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
