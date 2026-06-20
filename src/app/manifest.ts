import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NestDesk – Property Management",
    short_name: "NestDesk",
    description: "Modern property management platform for PGs, hostels, and co-living spaces.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
