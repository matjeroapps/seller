import Link from 'next/link';

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet';

export interface StitchAction {
  label: string;
  href?: string;
  variant?: 'primary' | 'secondary';
}

export interface StitchMetric {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}

export interface StitchField {
  label: string;
  value: string;
  hint?: string;
  type?: 'input' | 'select' | 'textarea' | 'toggle' | 'check';
}

export interface StitchSectionItem {
  title: string;
  meta: string;
  status?: string;
  tone?: Tone;
}

export interface StitchSection {
  title: string;
  kicker?: string;
  description?: string;
  fields?: StitchField[];
  items?: StitchSectionItem[];
}

export interface SellerStitchScreenConfig {
  eyebrow: string;
  title: string;
  description: string;
  actions?: StitchAction[];
  metrics?: StitchMetric[];
  sections: StitchSection[];
  rail?: StitchSection[];
}

function toneClasses(tone: Tone = 'slate') {
  const tones: Record<Tone, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-800'
  };

  return tones[tone];
}

function actionClassName(action: StitchAction) {
  if (action.variant === 'primary') {
    return 'inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800';
  }

  return 'inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50';
}

function StitchActionControl({ action }: { action: StitchAction }) {
  const className = actionClassName(action);

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" className={`${className} cursor-not-allowed opacity-60`} disabled title="بانتظار ربط واجهة API">
      {action.label}
    </button>
  );
}

function StitchActions({ actions, storeId }: { actions?: StitchAction[]; storeId: string }) {
  if (!actions?.length) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map((action) => (
        <StitchActionControl key={action.label} action={{ ...action, href: action.href?.replace(':storeId', storeId) }} />
      ))}
    </div>
  );
}

function StitchHeader({ screen, storeId }: { screen: SellerStitchScreenConfig; storeId: string }) {
  return (
    <header className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-800 to-slate-900 p-6 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-100">{screen.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{screen.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50">{screen.description}</p>
        </div>
        <StitchActions actions={screen.actions} storeId={storeId} />
      </div>
    </header>
  );
}

function StitchMetricCard({ metric }: { metric: StitchMetric }) {
  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${toneClasses(metric.tone)}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{metric.label}</p>
      <strong className="mt-3 block text-3xl font-black text-slate-950">{metric.value}</strong>
      <span className="mt-2 block text-sm font-semibold opacity-80">{metric.hint}</span>
    </article>
  );
}

function StitchMetrics({ metrics }: { metrics?: StitchMetric[] }) {
  if (!metrics?.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <StitchMetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function StitchFieldCard({ field }: { field: StitchField }) {
  const isToggle = field.type === 'toggle';
  const isCheck = field.type === 'check';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{field.label}</p>
          {field.hint && <p className="mt-1 text-xs leading-5 text-slate-500">{field.hint}</p>}
        </div>
        {isToggle && <span className="h-6 w-11 rounded-full bg-emerald-600 p-1 after:block after:h-4 after:w-4 after:rounded-full after:bg-white" aria-hidden="true" />}
        {isCheck && <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">✓</span>}
      </div>
      {!isToggle && !isCheck && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          {field.value}
        </div>
      )}
    </div>
  );
}

function StitchSectionHeading({ section }: { section: StitchSection }) {
  return (
    <div className="mb-4">
      {section.kicker && <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{section.kicker}</p>}
      <h2 className="mt-1 text-lg font-black text-slate-950">{section.title}</h2>
      {section.description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{section.description}</p>}
    </div>
  );
}

function StitchFields({ fields, title }: { fields?: StitchField[]; title: string }) {
  if (!fields?.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <StitchFieldCard key={`${title}-${field.label}`} field={field} />
      ))}
    </div>
  );
}

function StitchItemRow({ item }: { item: StitchSectionItem }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-black text-slate-900">{item.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{item.meta}</p>
      </div>
      {item.status && <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClasses(item.tone)}`}>{item.status}</span>}
    </div>
  );
}

function StitchItems({ items }: { items?: StitchSectionItem[] }) {
  if (!items?.length) return null;

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <StitchItemRow key={item.title} item={item} />
      ))}
    </div>
  );
}

function StitchSectionCard({ section }: { section: StitchSection }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <StitchSectionHeading section={section} />
      <StitchFields fields={section.fields} title={section.title} />
      <StitchItems items={section.items} />
    </section>
  );
}

function StitchSections({ sections }: { sections?: StitchSection[] }) {
  if (!sections?.length) return null;

  return (
    <>
      {sections.map((section) => (
        <StitchSectionCard key={section.title} section={section} />
      ))}
    </>
  );
}

function StitchContent({ screen }: { screen: SellerStitchScreenConfig }) {
  const layoutClassName = screen.rail ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid gap-6';

  return (
    <div className={layoutClassName}>
      <div className="grid gap-6">
        <StitchSections sections={screen.sections} />
      </div>
      {screen.rail && (
        <aside className="grid content-start gap-6">
          <StitchSections sections={screen.rail} />
        </aside>
      )}
    </div>
  );
}

export function SellerStitchScreen({ screen, storeId }: { screen: SellerStitchScreenConfig; storeId: string }) {
  return (
    <div dir="rtl" lang="ar" className="mx-auto grid max-w-7xl gap-6 text-right">
      <StitchHeader screen={screen} storeId={storeId} />
      <StitchMetrics metrics={screen.metrics} />
      <StitchContent screen={screen} />
    </div>
  );
}
