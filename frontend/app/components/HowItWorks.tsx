export default function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "See the reviewer code",
      description: "Note the reviewer code shown during your Brototype review.",
    },
    {
      number: "2",
      title: "Search in Reviewer Bucket",
      description: "Search by reviewer code or name to open their profile.",
    },
    {
      number: "3",
      title: "Find the reviewer",
      description: "Explore what students have shared and prepare with confidence.",
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-border px-4 py-16 md:py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium block">
            Workflow
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            How Reviewer Bucket Works
          </h2>
          <p className="text-sm text-secondary leading-relaxed">
            A simple three-step process to find your reviewer, learn from previous assessment experiences, and prepare with clarity.
          </p>
        </div>

        <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col items-center justify-center text-center gap-3 p-6 sm:p-7 rounded-2xl border border-border bg-surface/60 shadow-2xs hover:border-border/80 transition-colors"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {step.number}
              </span>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
