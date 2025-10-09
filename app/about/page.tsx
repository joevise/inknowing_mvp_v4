/**
 * 关于知应页面 - 介绍InKnowing的理念和愿景
 */

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero区域 */}
        <section className="py-20 px-6 bg-gradient-to-br from-[#2C5530] to-[#234426] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-light mb-6">
              关于 InKnowing 知应
            </h1>
            <p className="text-lg md:text-xl font-light opacity-90 leading-relaxed">
              让知识流动，与经典对话
            </p>
          </div>
        </section>

        {/* 我们的理念 */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">我们的理念</h2>

            <div className="space-y-8">
              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">💡 让知识触手可及</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  InKnowing 相信，每一本经典书籍都蕴含着深刻的智慧。通过 AI 技术，我们让这些智慧不再静静躺在书架上，而是能够主动与您对话，回答您的疑问，启发您的思考。
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">🎭 与角色深度对话</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  不仅仅是了解故事情节，更能与书中角色进行深入交流。想知道鲁智深如何看待当今世界？想向简·爱请教人生选择？在 InKnowing，这一切都成为可能。
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">🌱 个性化学习体验</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  每个人的学习方式都不同。InKnowing 通过智能对话系统，根据您的提问和兴趣，提供个性化的知识探索路径，让学习变得自然而有趣。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 我们的使命 */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">我们的使命</h2>

            <div className="prose prose-lg max-w-none">
              <p className="font-light text-gray-600 leading-relaxed text-center mb-8">
                在信息爆炸的时代，我们致力于：
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">📚</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">传承经典</h3>
                  <p className="font-light text-sm text-gray-600">
                    用现代技术赋予经典书籍新的生命力
                  </p>
                </div>

                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">🤝</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">连接智慧</h3>
                  <p className="font-light text-sm text-gray-600">
                    在读者与作品之间建立深度对话的桥梁
                  </p>
                </div>

                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">✨</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">启发思考</h3>
                  <p className="font-light text-sm text-gray-600">
                    激发每个人内心的好奇心和求知欲
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 技术特色 */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">技术特色</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">智能AI对话</h3>
                    <p className="font-light text-sm text-gray-600">
                      基于先进的大语言模型，实现自然流畅的知识对话
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">RAG检索增强</h3>
                    <p className="font-light text-sm text-gray-600">
                      精准检索书籍内容，确保回答的准确性和相关性
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">角色人格模拟</h3>
                    <p className="font-light text-sm text-gray-600">
                      深度还原书中角色的性格特点和说话风格
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💾</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">对话历史记录</h3>
                    <p className="font-light text-sm text-gray-600">
                      保存您的学习轨迹，随时续接之前的对话
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA区域 */}
        <section className="py-20 px-6 bg-gradient-to-br from-[#2C5530] to-[#234426] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-light mb-6">
              开始您的知识对话之旅
            </h2>
            <p className="text-lg font-light opacity-90 mb-8">
              与经典书籍和角色展开深度对话，发现知识的无限可能
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/books"
                className="px-8 py-3 bg-white text-[#2C5530] rounded-lg font-light hover:bg-gray-100 transition-colors"
              >
                浏览书籍
              </a>
              <a
                href="/auth/register"
                className="px-8 py-3 bg-white/10 text-white border border-white rounded-lg font-light hover:bg-white/20 transition-colors"
              >
                注册账户
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
