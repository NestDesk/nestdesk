export function HeroIllustration() {
  return (
    <div className="relative w-full max-w-[500px] select-none">
      {/* Ambient glow behind the card */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      {/* ── Main dashboard mockup ── */}
      <div className="animate-float overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/15 dark:shadow-primary/20">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className="ml-1.5 text-xs text-muted-foreground">
            NestDesk · Dashboard
          </span>
        </div>

        <div className="flex">
          {/* Mini sidebar */}
          <div className="hidden w-28 flex-col gap-0.5 border-r border-border/40 bg-sidebar p-2 sm:flex">
            {[
              { label: "Dashboard", active: true },
              { label: "Tenants", active: false },
              { label: "Payments", active: false },
              { label: "Rooms", active: false },
              { label: "Notices", active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-white" : "text-sidebar-foreground/50"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 space-y-3 p-3">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Tenants",
                  value: "24",
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  label: "Occupancy",
                  value: "75%",
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: "Collected",
                  value: "₹54K",
                  color: "text-blue-600",
                  bg: "bg-blue-600/10",
                },
                {
                  label: "Pending",
                  value: "₹6K",
                  color: "text-orange-500",
                  bg: "bg-orange-500/10",
                },
              ].map(({ label, value, color, bg }) => (
                <div
                  key={label}
                  className={`rounded-xl border border-border/40 ${bg} p-2.5`}
                >
                  <p className={`text-[10px] font-medium ${color}`}>{label}</p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Room grid */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Room Occupancy
              </p>
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-4 rounded-md ${
                      i < 18 ? "bg-primary/75" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="space-y-1.5 rounded-xl border border-border/40 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </p>
              {[
                {
                  name: "Ravi Sharma",
                  action: "Paid ₹3,000",
                  dot: "bg-emerald-400",
                },
                { name: "Priya Menon", action: "Checked in", dot: "bg-blue-400" },
                { name: "Arjun Patel", action: "Room 14", dot: "bg-orange-400" },
              ].map(({ name, action, dot }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  <span className="truncate text-[10px] font-medium text-foreground">
                    {name}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating: Payment received */}
      <div className="absolute -right-6 top-8 rounded-xl border border-border bg-card px-3 py-2 shadow-xl shadow-black/10 dark:shadow-black/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 text-emerald-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2,8 6,12 14,4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Payment received</p>
            <p className="text-[10px] text-muted-foreground">Room 7 · ₹3,000</p>
          </div>
        </div>
      </div>

      {/* Floating: New tenant */}
      <div className="absolute -left-6 bottom-14 rounded-xl border border-border bg-card px-3 py-2 shadow-xl shadow-black/10 dark:shadow-black/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-400 text-[10px] font-bold text-white shadow shadow-primary/30">
            RS
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Ravi Sharma</p>
            <p className="text-[10px] text-muted-foreground">Checked in · Room 4</p>
          </div>
        </div>
      </div>

      {/* Floating: Reminder badge */}
      <div className="absolute -right-2 bottom-8 rounded-xl border border-border bg-card px-3 py-2 shadow-xl shadow-black/10 dark:shadow-black/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15">
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 text-orange-500"
              fill="currentColor"
            >
              <path d="M8 1a5.5 5.5 0 00-5.5 5.5v1.586l-.707.707A1 1 0 003 10.5h10a1 1 0 00.707-1.707L13 8.086V6.5A5.5 5.5 0 008 1zM6 12a2 2 0 104 0H6z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Rent due</p>
            <p className="text-[10px] text-muted-foreground">4 tenants · 2 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
