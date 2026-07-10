import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const sections = [
  {
    title: '信息收集',
    body: [
      '注册信息：邮箱、用户名、密码。密码将通过 bcrypt 加密后存储。',
      '对话记录：用户与 AI 的对话内容，用于提供知识对话服务。',
      '使用数据：登录时间、操作日志等基础服务运行数据。',
    ],
  },
  {
    title: '信息使用',
    body: [
      '我们使用相关信息为用户提供知识对话服务，并通过记忆功能优化 AI 对话质量。',
      '我们不会出售用户个人信息，也不会将用户信息分享给第三方用于商业营销。',
    ],
  },
  {
    title: '数据安全',
    body: [
      '用户密码采用加密方式存储，数据库会进行定期备份。',
      '平台通过 HTTPS 加密传输降低数据在传输过程中的泄露风险。',
    ],
  },
  {
    title: '用户权利',
    body: [
      '用户可以查看、修改个人信息，也可以申请删除账户和相关数据。',
      '如需行使相关权利，请联系：admin@inknowing.ai。',
    ],
  },
  {
    title: 'Cookie 说明',
    body: [
      '平台使用 session cookie 维持登录状态，以便识别用户身份并提供连续的服务体验。',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-3xl md:text-4xl font-light text-[#2C5530] mb-4">隐私政策</h1>
            <p className="text-sm font-light text-gray-500">最后更新：2026 年 7 月 10 日</p>
          </div>

          <div className="space-y-6">
            {sections.map(section => (
              <section key={section.title} className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-light text-[#2C5530] mb-4">{section.title}</h2>
                <div className="space-y-3">
                  {section.body.map((paragraph, index) => (
                    <p key={index} className="font-light text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
