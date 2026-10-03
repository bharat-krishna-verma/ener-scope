/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true, // start the scrape/email scheduler at server boot
    serverComponentsExternalPackages: ["mongoose", "cheerio", "nodemailer"],
  },
};
export default nextConfig;
