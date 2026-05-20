export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-auth px-4">
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

      {/* Brand watermark */}
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/30">
          NestDesk
        </span>
      </div>

      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
