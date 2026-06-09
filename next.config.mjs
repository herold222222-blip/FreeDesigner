/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** ECS 构建跳过 ESLint，本地仍可通过 npm run lint 检查 */
  eslint: {
    ignoreDuringBuilds: true,
  },
  /** 缩小 lucide / recharts 等大包的编译体积，加快 next build */
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
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
