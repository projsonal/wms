import { useEffect, useState } from 'react';

/**
 * Input pencarian yang di-debounce sebelum dikirim sebagai parameter
 * `search` ke backend (server-side search) — dipakai bareng
 * useServerPaginatedList supaya query tidak ditembak di setiap ketikan.
 */
export function useDebouncedSearch(delayMs = 400): {
  input: string;
  setInput: (value: string) => void;
  term: string;
} {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(input.trim()), delayMs);
    return () => window.clearTimeout(timer);
  }, [input, delayMs]);

  return { input, setInput, term };
}
