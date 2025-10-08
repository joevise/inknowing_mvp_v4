/**
 * 统一的页面底部组件
 * MUJI风格：简洁、细字体
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#FAF9F7] border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* 关于 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">关于知应</h3>
            <p className="font-light text-xs text-gray-600 leading-relaxed">
              InKnowing 是一个基于 AI 的知识对话平台，
              让经典书籍和角色与您对话，开启智能学习之旅。
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">快速链接</h3>
            <ul className="space-y-2">
              <li>
                <a href="/books" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  浏览书籍
                </a>
              </li>
              <li>
                <a href="/characters" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  热门角色
                </a>
              </li>
              <li>
                <a href="/auth/login" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  登录账户
                </a>
              </li>
            </ul>
          </div>

          {/* 帮助与支持 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">帮助与支持</h3>
            <ul className="space-y-2">
              <li>
                <a href="/help" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  使用指南
                </a>
              </li>
              <li>
                <a href="/faq" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  常见问题
                </a>
              </li>
              <li>
                <a href="/contact" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  联系我们
                </a>
              </li>
            </ul>
          </div>

          {/* 法律信息 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">法律信息</h3>
            <ul className="space-y-2">
              <li>
                <a href="/terms" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  使用条款
                </a>
              </li>
              <li>
                <a href="/privacy" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  隐私政策
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="pt-8 border-t border-gray-200 text-center">
          <p className="font-light text-xs text-gray-500">
            © {currentYear} InKnowing 知应. All rights reserved.
          </p>
          <p className="font-light text-xs text-gray-400 mt-2">
            Powered by AI · Made with care
          </p>
        </div>
      </div>
    </footer>
  );
}
