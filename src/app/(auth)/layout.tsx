import Link from "next/link";
import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-auth">
      {/* Animated blobs */}
      <div className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
      <div className="animate-blob-delay-2 pointer-events-none absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-3xl" />
      <div className="animate-blob-delay-4 pointer-events-none absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-cyan-400/10 blur-3xl" />

      {/* Dot grid */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
      >
        <defs>
          <pattern
            id="auth-dots"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>

      {/* Sticky navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">NestDesk</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Centered card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
