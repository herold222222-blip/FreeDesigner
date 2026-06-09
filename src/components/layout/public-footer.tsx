import Link from "next/link";
import { Sparkles } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="mt-24 border-t border-ink-20 bg-ink-20/20">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold text-ink">乐自由</div>
          </div>
          <p className="max-w-md text-sm text-ink-60">
            建筑、景观、室内、效果图/动画、造价咨询五大设计专业的双向对接平台。让委托方找到对的设计师,
            让设计师专注创造,资金与权益由平台全程托管。
          </p>
          <div className="text-xs text-ink-40">
            © 2026 乐自由设计平台 · 沪 ICP 备 2026 0501 号
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-medium text-ink">产品能力</div>
          <Link href="/designers" className="block text-ink-60 hover:text-ink">
            找设计
          </Link>
          <Link href="/bounties" className="block text-ink-60 hover:text-ink">
            悬赏招标
          </Link>
          <Link href="/entrust/new" className="block text-ink-60 hover:text-ink">
            发布项目需求
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-medium text-ink">关于平台</div>
          <Link
            href="/login?console=admin"
            className="block text-ink-60 hover:text-ink"
          >
            管理员后台
          </Link>
          <a className="block text-ink-60 hover:text-ink">服务协议</a>
          <a className="block text-ink-60 hover:text-ink">隐私政策</a>
          <a className="block text-ink-60 hover:text-ink">加入我们</a>
        </div>
      </div>
    </footer>
  );
}
