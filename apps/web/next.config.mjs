/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // i18n: App Router uses [locale] route segments + middleware instead of next.config i18n.
  // Supported locales: ["en", "hi", "gu"] — implement via src/middleware.ts + app/[locale] layout.
};

export default nextConfig;
