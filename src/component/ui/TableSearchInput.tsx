'use client';

interface TableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Input pencarian untuk dipasang di prop `toolbar` DataTable saat
 * `serverPagination` aktif (search bawaan DataTable otomatis disembunyikan
 * karena pencariannya harus lewat backend, bukan filter di memori).
 */
export function TableSearchInput({ value, onChange, placeholder = 'Cari......' }: Readonly<TableSearchInputProps>): React.JSX.Element {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full rounded-full border border-borderSoft bg-surfaceAlt px-4 py-2 text-sm outline-none focus:border-accent sm:w-56"
    />
  );
}
