import Link from "next/link";
import { ArrowRight, MessageSquare, Lock, Repeat } from "lucide-react";

export default function CommunitySection() {
  const points = [
    {
      title: "Read experiences",
      desc: "Understand assessment focus and question styles beforehand.",
    },
    {
      title: "Share your experience",
      desc: "Post your review questions and feedback without attaching your name.",
    },
    {
      title: "Discuss with others",
      desc: "Ask questions and exchange preparation tips with other students.",
    },
  ];

  const loopSteps = [
    { step: "01", title: "Find a reviewer", desc: "Look up your code" },
    { step: "02", title: "Read experiences", desc: "Understand focus areas" },
    { step: "03", title: "Take your review", desc: "Go in prepared" },
    { step: "04", title: "Share feedback", desc: "Post questions asked" },
    { step: "05", title: "Help next student", desc: "Support the community" },
  ];

  return (
    <div className="border-t border-border">
      {/* ── Community Value ─────────────────────────────────────────────────── */}
      <section className="px-4 py-16 md:py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium block">
              Community
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Your experience can help the next student.
            </h2>
            <p className="text-sm text-secondary leading-relaxed pt-1">
              Read what others experienced with a reviewer, share what happened in your own review, and give the next student a little more context.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {points.map((pt) => (
              <div
                key={pt.title}
                className="p-6 sm:p-7 rounded-2xl border border-border bg-surface/60 shadow-2xs space-y-2 text-center"
              >
                <h3 className="text-base font-semibold text-foreground">{pt.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experience Loop ──────────────────────────────────────────────────── */}
      <section id="community-loop" className="border-t border-border px-4 py-16 md:py-20 sm:px-6 lg:px-8 bg-surface/30">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="space-y-1.5 text-center max-w-xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium flex items-center justify-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-blue-500" />
              <span>Contribution Cycle</span>
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              How the community becomes more useful over time
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {loopSteps.map((item, idx) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl border border-border bg-surface shadow-2xs flex flex-col justify-between gap-3 text-center relative"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-muted uppercase">
                    Step {item.step}
                  </span>
                  <h3 className="text-sm font-bold text-foreground mt-1">{item.title}</h3>
                  <p className="text-xs text-secondary leading-relaxed mt-1">{item.desc}</p>
                </div>
                {idx < loopSteps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted/40">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community Discussion & Private Conversations ─────────────────────── */}
      <section className="border-t border-border px-4 py-16 md:py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Community Chat */}
            <div className="p-7 sm:p-8 rounded-3xl border border-border bg-surface/60 flex flex-col justify-between gap-6 shadow-2xs text-center items-center">
              <div className="space-y-2.5 max-w-md">
                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-muted">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>Discussion Space</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Talk about what you experienced.
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Students can discuss Brototype reviews, questions, observations, and feedback without attaching their name to the conversation.
                </p>
              </div>

              <div>
                <Link
                  href="/community"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  <span>Open Community</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Private Conversations */}
            <div className="p-7 sm:p-8 rounded-3xl border border-border bg-surface/60 flex flex-col justify-between gap-6 shadow-2xs text-center items-center">
              <div className="space-y-2.5 max-w-md">
                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-muted">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>1-on-1 Messages</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Continue the conversation privately.
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Take a useful conversation one-to-one when the public community isn&apos;t the right place. You can also message the developer directly.
                </p>
              </div>

              <div>
                <Link
                  href="/private-chats"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-elevated text-foreground text-xs font-semibold transition-colors"
                >
                  <span>Private Chats</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
