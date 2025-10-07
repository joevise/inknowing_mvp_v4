/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用React严格模式
  reactStrictMode: true,

  // 图片配置
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 环境变量配置
  env: {
    NEXT_PUBLIC_APP_NAME: 'InKnowing',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  // 实验性功能
  experimental: {
    // 服务器组件外部包
    serverComponentsExternalPackages: ['better-sqlite3', 'chromadb'],
  },

  // Webpack配置
  webpack: (config, { isServer }) => {
    // 处理 better-sqlite3 的原生模块
    if (isServer) {
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
      });
    }

    // 忽略某些警告
    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ },
    ];

    return config;
  },

  // 输出配置
  output: 'standalone',

  // API路由配置
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;