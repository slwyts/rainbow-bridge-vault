/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Reduce chunk splitting for static export
  experimental: {
    // Disable granular chunks to reduce file count
  },
};

export default nextConfig;
