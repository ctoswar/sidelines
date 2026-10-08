import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 px-5 py-8 text-sm text-muted ${className}`}>
      <span>© {new Date().getFullYear()} Sidelines</span>
      <span className="flex gap-5">
        <Link href="/contact-us" className="hover:text-fg">Contact us</Link>
        <Link href="/privacy-policy" className="hover:text-fg">Privacy policy</Link>
        <Link href="/terms-of-service" className="hover:text-fg">Terms of service</Link>
      </span>
    </footer>
  );
}
