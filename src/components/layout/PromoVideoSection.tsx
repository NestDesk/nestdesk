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
    <section id="video" className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-4">
      <div className="w-full rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Video walkthrough
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              See NestDesk in action in under a minute
            </h2>
            <p className="max-w-4xl text-base text-muted-foreground">
              Watch the core owner workflow in one place: setup, tenant
              tracking, payments, and daily operations.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-black p-2 sm:p-3">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            muted
            preload="metadata"
            loop
            className="aspect-video w-full rounded-xl border border-white/10 bg-black"
          />
        </div>
      </div>
    </section>
  );
}
