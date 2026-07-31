import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/profile",
        "/admin",
        "/checklist/",
        "/survey/",
        "/plan/",
        "/gaps/",
        "/login",
        "/register",
        "/disclaimer",
        "/feedback",
        "/vendors/",
      ],
    },
    sitemap: "https://afteratlas.com/sitemap.xml",
  };
}
