import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DesignerCard } from "@/components/domain/designer-card";
import { BountyCard } from "@/components/domain/bounty-card";
import { listDesigners, listBounties } from "@/lib/server/repo";
import { SPECIALTIES } from "@/lib/constants";
import {
  ArrowRight,
  ShieldCheck,
  Wallet,
  FileSignature,
  Sparkles,
  Building2,
  TreeDeciduous,
  Sofa,
  Camera,
  Coins,
  CalendarRange,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [allDesigners, allBounties] = await Promise.all([
    listDesigners(),
    listBounties(),
  ]);
  const topDesigners = [...allDesigners]
    .sort((a, b) => {
      const ao = a.onlineStatus === "online" ? 1 : 0;
      const bo = b.onlineStatus === "online" ? 1 : 0;
      return bo - ao;
    })
    .slice(0, 6);
  const hotBounties = allBounties.slice(0, 3);

  return (
    <>
      <section className="gradient-hero overflow-x-clip">
        {/* 右下角悬浮卡片 absolute -bottom-6，需预留底部留白避免压到下一版块 */}
        <div className="container-page pb-28 pt-20 lg:pb-36 lg:pt-28">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-7">
              <Badge variant="outline" className="gap-1.5">
                <Sparkles className="h-3 w-3 text-brand" />
                建筑 · 景观 · 室内 · 效果图 · 造价 五大专业 一站式对接
              </Badge>
              <h1 className="text-balance text-5xl font-semibold leading-[1.1] tracking-tight text-ink lg:text-6xl">
                让对的设计师，
                <br />
                <span className="text-brand">遇见对的项目。</span>
              </h1>
              <p className="max-w-xl text-base text-ink-60">
                乐自由是面向工程设计行业的双向对接平台。委托方可直接搜索设计师下单，
                或公开悬赏招标；设计师在线交付方案与施工图，
                平台托管资金、自动签署电子合同、分阶段结算，让合作干净透明。
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="brand" className="gap-2">
                  <Link href="/entrust/new">
                    发布委托项目 <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/designers">
                    浏览全部设计师 <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-6 border-t border-ink-20 pt-6 text-center md:max-w-md md:text-left">
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-ink">
                    1,860+
                  </div>
                  <div className="text-xs text-ink-60">入驻认证设计师</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-ink">
                    24,300+
                  </div>
                  <div className="text-xs text-ink-60">完成项目订单</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-ink">
                    99.6%
                  </div>
                  <div className="text-xs text-ink-60">合同履约率</div>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-3xl">
                  <Image
                    src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&q=80"
                    alt="建筑"
                    width={600}
                    height={800}
                    className="h-72 w-full object-cover"
                  />
                </div>
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-3xl">
                    <Image
                      src="https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=80"
                      alt="室内"
                      width={600}
                      height={400}
                      className="h-32 w-full object-cover"
                    />
                  </div>
                  <div className="overflow-hidden rounded-3xl">
                    <Image
                      src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&q=80"
                      alt="景观"
                      width={600}
                      height={400}
                      className="h-36 w-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <Card className="absolute -bottom-6 left-4 flex items-center gap-3 px-4 py-3 shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-ink-60">资金已托管</div>
                  <div className="text-sm font-semibold text-ink">
                    分阶段付款 · 平台监管，不满意退款
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <Badge variant="muted" className="mb-3">
              专业服务
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              五大专业领域
            </h2>
            <p className="mt-2 text-sm text-ink-60">
              建筑 / 景观 / 室内 · 效果图 / 动画 · 造价咨询，三级专业层级精细化匹配。
            </p>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {SPECIALTIES.map((s) => {
            const Icon =
              s.value === "architecture"
                ? Building2
                : s.value === "landscape"
                  ? TreeDeciduous
                  : s.value === "interior"
                    ? Sofa
                    : s.value === "rendering"
                      ? Camera
                      : Coins;
            return (
              <Card key={s.value} className="h-full p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-20/50">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">
                  {s.label}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-xs text-ink-60">
                  {s.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="container-page pb-20 pt-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Badge variant="muted" className="mb-3">
              悬赏大厅
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              正在招标的项目
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/bounties">
              全部悬赏 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {hotBounties.map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Badge variant="muted" className="mb-3">
              热门设计师
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              在线设计师 · 实时接单
            </h2>
            <p className="mt-2 text-sm text-ink-60">
              在线设计师优先展示,头像旁的指示灯反映近期登录活跃度。
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/designers">
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topDesigners.map((d) => (
            <DesignerCard key={d.id} designer={d} />
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Badge variant="muted" className="mb-3">
              v1.1 增值服务
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              一个平台 · 三层服务保障
            </h2>
            <p className="mt-2 text-sm text-ink-60">
              在设计交付之外，平台还提供专业审图与项目管理两项增值服务，
              帮助委托人把控质量与进度。
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/calculator">
              <Coins className="h-4 w-4" /> 试用费用计算器
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="p-6">
            <Badge variant="brand" className="mb-3">设计 · 必选</Badge>
            <h3 className="text-lg font-semibold text-ink">在线设计交付</h3>
            <p className="mt-2 text-sm text-ink-60">
              从方案、扩初到施工图、竣工图全阶段，五大专业三级专业精细划分。
              支持远程交付与驻场服务。
            </p>
            <div className="mt-4 text-xs text-ink-40">
              出图费 = 基数 × 8 项系数（地区 / 类型 / 等级 / 客户 / 难度 / 协调 / 建造 / 税率）
            </div>
          </Card>
          <Card className="p-6">
            <Badge variant="amber" className="mb-3">审图 · 可加购</Badge>
            <h3 className="text-lg font-semibold text-ink">独立第三方审图</h3>
            <p className="mt-2 text-sm text-ink-60">
              资深审图师对设计师图纸进行审核并出具审图文档，确保质量到位。
              审图师对设计师从「不及格」到「杰出」分五档评级。
            </p>
            <div className="mt-4 text-xs text-ink-40">
              定价：对应专业出图费的 8%，可单选或全选所有三级专业
            </div>
          </Card>
          <Card className="p-6">
            <Badge variant="violet" className="mb-3">项目管理 · 可加购</Badge>
            <h3 className="text-lg font-semibold text-ink">项目经理代为统筹</h3>
            <p className="mt-2 text-sm text-ink-60">
              对外与客户沟通、线上线下参会，对内协调各专业，输出会议纪要并把控进度。
              选择与客户同城的项目经理。
            </p>
            <div className="mt-4 text-xs text-ink-40">定价：项目总设计费的 20%</div>
          </Card>
        </div>
      </section>

      <section className="bg-ink-20/30">
        <div className="container-page py-20">
          <div className="mb-12 text-center">
            <Badge variant="muted" className="mb-3">
              如何运作
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              四步走完一笔放心的设计合作
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              {
                icon: Sparkles,
                step: "01",
                title: "找人 / 发悬赏",
                desc: "搜索定向下单,或公开悬赏让设计师主动报名。",
              },
              {
                icon: FileSignature,
                step: "02",
                title: "签电子合同",
                desc: "双方确认合作后系统自动出合同,永久存档可查。",
              },
              {
                icon: CalendarRange,
                step: "03",
                title: "分阶段交付",
                desc: "设计师上传成果 → 委托人在线预览 → 付款解锁下载。",
              },
              {
                icon: Wallet,
                step: "04",
                title: "托管 + 结算",
                desc: "资金 30 天托管,验收无误自动解冻,设计师一键提现。",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.step} className="p-6">
                  <div className="text-xs font-semibold tracking-widest text-brand">
                    {item.step}
                  </div>
                  <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-ink-60">{item.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <Card className="overflow-hidden bg-ink p-12 text-white">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-5">
              <Badge variant="brand" className="bg-brand/15 text-white">
                <Coins className="h-3 w-3" /> 立即开始你的下一个项目
              </Badge>
              <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
                把繁琐留给平台,
                <br />
                把创造留给设计师。
              </h2>
              <p className="max-w-xl text-sm text-white/70">
                定向找人、悬赏招标、电子合同、分阶段托管、按月雇佣、
                自动结算 —— 一个平台一次搞定。
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" variant="brand">
                  <Link href="/designers">浏览设计师</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10"
                >
                  <Link href="/entrust/new?mode=bounty">发布悬赏</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-wider text-white/50">
                  典型客户案例
                </div>
                <div className="mt-2 text-base font-semibold">
                  禹生文旅 · 苏州相城公园
                </div>
                <div className="mt-1 text-xs text-white/60">
                  通过悬赏匹配到 3 位资深景观设计师,4 周完成方案文本汇报。
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-wider text-white/50">
                  典型设计师故事
                </div>
                <div className="mt-2 text-base font-semibold">
                  陈牧之 · 景观施工图设计师
                </div>
                <div className="mt-1 text-xs text-white/60">
                  入驻 8 个月承接 11 单,平台托管资金确保每一笔都按时到账。
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
