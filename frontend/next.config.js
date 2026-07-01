/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'api.spotflow.pro' },
    ],
  },
};

module.exports = nextConfig;
