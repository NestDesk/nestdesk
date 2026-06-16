"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

import image2 from "../../assets/screenshots/2.png";
import image3 from "../../assets/screenshots/3.png";
import image4 from "../../assets/screenshots/4.png";
import image5 from "../../assets/screenshots/5.png";
import image6 from "../../assets/screenshots/6.png";
import image7 from "../../assets/screenshots/7.png";
import image8 from "../../assets/screenshots/8.png";
import image9 from "../../assets/screenshots/9.png";
import image10 from "../../assets/screenshots/10.png";

const screenshots = [
  { src: image2, alt: "Owner's Dashboard" },
  { src: image3, alt: "Property Setup and Management" },
  { src: image4, alt: "Tenant Management" },
  { src: image5, alt: "Expense Tracking" },
  { src: image6, alt: "Protery Live Occupanacy" },
  { src: image7, alt: "Publish Notices" },
  { src: image8, alt: "Manage Maintenance Requests" },
  { src: image9, alt: "Detailed Reports & Analytics" },
  { src: image10, alt: "Property Settings" },
];

export function ScreenshotCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedSlide, setSelectedSlide] = useState<(typeof screenshots)[number] | null>(null);

  const visibleSlides = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => screenshots[(activeIndex + index) % screenshots.length]);
  }, [activeIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % screenshots.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  const moveSlide = (direction: "prev" | "next") => {
    setActiveIndex((prev) =>
      direction === "next"
        ? (prev + 1) % screenshots.length
        : (prev - 1 + screenshots.length) % screenshots.length,
    );
  };

  return (
    <section id="demo" className="mx-auto max-w-7xl px-3 py-4 sm:px-5 lg:py-6">
      <div className="rounded-[24px] border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-4 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Demo at a glance
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              A cleaner product tour, built for quick scanning
            </h2>
          </div>
          <div className="flex items-center justify-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveSlide("prev")}
              aria-label="Show previous screenshot"
              className="h-10 w-10 rounded-full border-border/70 bg-background/90 shadow-sm hover:bg-primary/8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveSlide("next")}
              aria-label="Show next screenshot"
              className="h-10 w-10 rounded-full border-border/70 bg-background/90 shadow-sm hover:bg-primary/8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-border/60 bg-background/70 p-2 shadow-inner shadow-primary/5 sm:p-3">
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleSlides.map((slide, index) => (
              <article
                key={`${slide.alt}-${activeIndex}-${index}`}
                className="group min-w-[360px] flex-1 overflow-hidden rounded-[18px] border border-border/60 bg-background/95 p-2 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 sm:min-w-[420px] sm:p-3 lg:min-w-[460px]"
              >
                <button
                  type="button"
                  onClick={() => setSelectedSlide(slide)}
                  className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={`Open ${slide.alt} in full view`}
                >
                  <div className="overflow-hidden rounded-[14px] bg-gradient-to-br from-muted/80 via-background to-primary/5 p-1.5 sm:p-2">
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      width={slide.src.width}
                      height={slide.src.height}
                      sizes="(max-width: 1280px) 95vw, 44vw"
                      className="h-auto w-full rounded-[10px] border border-border/50 object-contain shadow-sm transition-transform duration-500 group-hover:scale-[1.02]"
                      priority={index === 0}
                    />
                  </div>
                </button>
                <div className="mt-2 px-1 pb-0.5">
                  <p className="text-sm font-semibold text-foreground">{slide.alt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tap to open the full preview.</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <Dialog open={Boolean(selectedSlide)} onOpenChange={(open) => !open && setSelectedSlide(null)}>
          <DialogContent className="max-w-7xl border-border/60 bg-background/95 p-0 shadow-2xl">
            {selectedSlide ? (
              <>
                <DialogHeader className="px-2 pt-2 text-left">
                  <DialogTitle className="text-xl font-semibold">{selectedSlide.alt}</DialogTitle>
                 
                </DialogHeader>
                <div className="mx-6 mb-6 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 p-3 sm:p-4">
                  <Image
                    src={selectedSlide.src}
                    alt={selectedSlide.alt}
                    width={selectedSlide.src.width}
                    height={selectedSlide.src.height}
                    sizes="(max-width: 768px) 100vw, 80vw"
                    className="h-auto w-full rounded-xl object-contain"
                    priority
                  />
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 p-2.5 sm:p-3">
          <p className="text-sm text-muted-foreground">Swipe through the complete product preview with the dots below.</p>
          <div className="flex items-center justify-center gap-2">
          {screenshots.map((slide, index) => (
            <button
              key={slide.alt}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to screenshot ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                index === activeIndex ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
