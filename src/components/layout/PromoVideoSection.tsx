"use client";

import { useEffect, useRef } from "react";

export function PromoVideoSection({ videoUrl }: { videoUrl?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry) return;

        if (entry.isIntersecting) {
          video.muted = true;
          void video.play()
            .then(() => {
              video.muted = false;
            })
            .catch(() => {
              // Autoplay can still be blocked until the user interacts with the page.
            });
        } else {
          video.pause();
          video.muted = true;
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="video" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="w-full rounded-[28px] border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:p-5 lg:p-6">
        <div className="mb-4 flex flex-col gap-3 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Video walkthrough
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              See NestDesk in action in under a minute
            </h2>
            <p className="max-w-4xl text-sm text-muted-foreground sm:text-base">
              Watch the core owner workflow in one place: setup, tenant
              tracking, payments, and daily operations.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-border/60 bg-black/95 p-2 shadow-inner shadow-primary/10 sm:p-3">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            muted
            preload="metadata"
            loop
            className="aspect-video w-full rounded-[20px] border border-white/10 bg-black shadow-inner"
          />
        </div>
      </div>
    </section>
  );
}
