import { ArrowRight } from "lucide-react";

export default function About() {
  const steps = [
    { label: "Find", desc: "Discover reviewers" },
    { label: "Learn", desc: "Read real feedback" },
    { label: "Share", desc: "Contribute questions" },
    { label: "Connect", desc: "Engage in community" },
  ];

  return (
    <section id="about" className="border-t border-border px-4 py-16 md:py-20 sm:px-6 lg:px-8 bg-surface/30">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium block">
            About
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            More than a reviewer lookup
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-secondary pt-1">
            Reviewer Bucket brings reviewer experiences and student conversations into one place. Find your reviewer, see what others experienced, and contribute your own perspective.
          </p>
        </div>

        {/* Spacious product flow sequence with centered content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div
              key={step.label}
              className="p-6 rounded-2xl border border-border bg-surface shadow-2xs flex flex-col items-center justify-center text-center gap-2 relative hover:border-border/80 transition-colors"
            >
              <span className="text-[11px] font-mono font-bold text-muted uppercase">
                0{idx + 1}
              </span>
              <h3 className="text-base font-bold text-foreground">{step.label}</h3>
              <p className="text-xs text-secondary leading-relaxed">{step.desc}</p>
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted/40">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
