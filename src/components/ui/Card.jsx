export default function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={`rounded border border-steel-200 bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-steel-200 px-5 py-4">
          <div className="min-w-0 flex-1 basis-48">
            {title && <h2 className="text-base font-semibold text-steel-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-steel-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
