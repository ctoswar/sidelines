import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-field text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="font-score text-3xl font-bold tracking-tight">Sidelines</Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">Events</Link>
          <Link href="/about" className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">About</Link>
          <Link href="/login" className="rounded-md border border-white/30 px-4 py-2 hover:bg-white/10">Log in</Link>
          <Link href="/signup" className="rounded-md bg-white px-4 py-2 font-bold text-[#14213d]">Sign up</Link>
        </nav>
      </div>
    </header>
  );
}
