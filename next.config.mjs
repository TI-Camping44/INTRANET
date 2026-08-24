/** @type {import('next').NextConfig} */
const configuracion = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};

export default configuracion;
