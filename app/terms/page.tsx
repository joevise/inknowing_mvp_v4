import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const sections = [
  {
    title: '服务说明',
    body: [
      'InKnowing 知应是一个基于 AI 的知识对话平台，通过大语言模型对书籍内容的理解和演绎，为用户提供与经典书籍和角色对话的体验。',
    ],
  },
  {
    title: '内容声明',
    body: [
      '平台不存储、不提供书籍原文内容。AI 对话基于模型对作品的理解和演绎，不代表原著作者立场。',
      '角色对话属于 AI 辅助的二次创作，仅供学习和交流目的。用户不得将对话内容用于商业出版或侵权用途。',
      '书籍封面图片来源于公开网络（如豆瓣读书），版权归原始出版方或作者所有。',
    ],
  },
  {
    title: '版权投诉机制（通知-删除）',
    body: [
      '如您是著作权人，发现平台内容涉及您的作品，请通过版权投诉页面提交投诉。',
      '我们将在收到有效投诉后 48 小时内处理，包括下架或调整相关内容。',
      '投诉需提供：作品名称、权属证明、联系方式。',
    ],
    link: true,
  },
  {
    title: '用户行为规范',
    body: [
      '用户不得利用平台从事违法活动，不得批量爬取、抓取、复制或滥用平台数据与服务。',
    ],
  },
  {
    title: '免责条款',
    body: [
      '平台不对 AI 生成内容的准确性、完整性或适用性承担责任。用户应自行判断 AI 回答内容，并以原始出版物、权威资料或专业意见为准。',
    ],
  },
  {
    title: '联系方式',
    body: ['如对本协议或平台服务有任何疑问，请联系：admin@inknowing.ai。'],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-3xl md:text-4xl font-light text-[#2C5530] mb-4">用户协议</h1>
            <p className="text-sm font-light text-gray-500">最后更新：2026 年 7 月 10 日</p>
          </div>

          <div className="space-y-6">
            {sections.map(section => (
              <section key={section.title} className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-light text-[#2C5530] mb-4">{section.title}</h2>
                <div className="space-y-3">
                  {section.body.map((paragraph, index) => (
                    <p key={index} className="font-light text-gray-700 leading-relaxed">
                      {section.link && index === 0 ? (
                        <>
                          如您是著作权人，发现平台内容涉及您的作品，请通过
                          <Link href="/copyright" className="text-[#2C5530] underline underline-offset-4 hover:text-[#234426]">
                            版权投诉页面
                          </Link>
                          提交投诉。
                        </>
                      ) : paragraph}
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
