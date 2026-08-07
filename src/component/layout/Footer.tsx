export function Footer(): React.JSX.Element {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-borderSoft px-8 py-5 text-xs text-textMuted">
      <p>stockrsd merupakan pelayanan gudang serta inventaris produk dalam perusahaan.</p>
      <div className="flex gap-4">
        <a href="#" className="hover:text-accent">
          Kebijakan
        </a>
        <a href="#" className="hover:text-accent">
          Syarat &amp; Ketentuan
        </a>
      </div>
    </footer>
  );
}
