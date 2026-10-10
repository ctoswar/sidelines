export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="dashboard-header mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="dashboard-eyebrow">Sidelines / {title}</p>
        <h1 className="mt-2 font-score text-5xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
