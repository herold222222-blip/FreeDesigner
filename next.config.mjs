/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** 全栈模式：含 API Routes、服务端鉴权与数据库，需服务端运行（不再静态导出） */
  /** 行政区划数据包为纯 ESM，显式编入可减少部分宿主环境下的打包差异 */
  transpilePackages: ["@vant/area-data"],
  images: {
    /** 暂关闭图片优化流水线（部署到支持优化的平台后可移除此项） */
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
