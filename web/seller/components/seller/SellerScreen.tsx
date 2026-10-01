import Link from 'next/link';

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet';

export interface SellerScreenAction {
  label: string;
  href?: string;
  variant?: 'primary' | 'secondary';
}

export interface SellerScreenMetric {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}

export interface SellerScreenField {
  label: string;
  value: string;
  hint?: string;
  type?: 'input' | 'select' | 'textarea' | 'toggle' | 'check';
}

export interface SellerScreenSectionItem {
  title: string;
  meta: string;
  status?: string;
  tone?: Tone;
}

export interface SellerScreenSection {
  title: string;
  kicker?: string;
  description?: string;
  fields?: SellerScreenField[];
  items?: SellerScreenSectionItem[];
}

export interface SellerScreenConfig {
  eyebrow: string;
  title: string;
  description: string;
  actions?: SellerScreenAction[];
  metrics?: SellerScreenMetric[];
  sections: SellerScreenSection[];
  rail?: SellerScreenSection[];
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

function actionClassName(action: SellerScreenAction) {
  if (action.variant === 'primary') {
    return 'inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800';
  }

  return 'inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50';
}

function SellerScreenActionControl({ action }: { action: SellerScreenAction }) {
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

function SellerScreenActions({ actions, storeId }: { actions?: SellerScreenAction[]; storeId: string }) {
  if (!actions?.length) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map((action) => (
        <SellerScreenActionControl key={action.label} action={{ ...action, href: action.href?.replace(':storeId', storeId) }} />
      ))}
    </div>
  );
}

function SellerHeader({ screen, storeId }: { screen: SellerScreenConfig; storeId: string }) {
  return (
    <header className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-800 to-slate-900 p-6 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-100">{screen.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{screen.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50">{screen.description}</p>
        </div>
        <SellerScreenActions actions={screen.actions} storeId={storeId} />
      </div>
    </header>
  );
}

function SellerScreenMetricCard({ metric }: { metric: SellerScreenMetric }) {
  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${toneClasses(metric.tone)}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{metric.label}</p>
      <strong className="mt-3 block text-3xl font-black text-slate-950">{metric.value}</strong>
      <span className="mt-2 block text-sm font-semibold opacity-80">{metric.hint}</span>
    </article>
  );
}

function SellerScreenMetrics({ metrics }: { metrics?: SellerScreenMetric[] }) {
  if (!metrics?.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <SellerScreenMetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function SellerScreenFieldCard({ field }: { field: SellerScreenField }) {
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

function SellerScreenSectionHeading({ section }: { section: SellerScreenSection }) {
  return (
    <div className="mb-4">
      {section.kicker && <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{section.kicker}</p>}
      <h2 className="mt-1 text-lg font-black text-slate-950">{section.title}</h2>
      {section.description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{section.description}</p>}
    </div>
  );
}

function SellerScreenFields({ fields, title }: { fields?: SellerScreenField[]; title: string }) {
  if (!fields?.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <SellerScreenFieldCard key={`${title}-${field.label}`} field={field} />
      ))}
    </div>
  );
}

function SellerItemRow({ item }: { item: SellerScreenSectionItem }) {
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

function SellerItems({ items }: { items?: SellerScreenSectionItem[] }) {
  if (!items?.length) return null;

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <SellerItemRow key={item.title} item={item} />
      ))}
    </div>
  );
}

function SellerScreenSectionCard({ section }: { section: SellerScreenSection }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <SellerScreenSectionHeading section={section} />
      <SellerScreenFields fields={section.fields} title={section.title} />
      <SellerItems items={section.items} />
    </section>
  );
}

function SellerScreenSections({ sections }: { sections?: SellerScreenSection[] }) {
  if (!sections?.length) return null;

  return (
    <>
      {sections.map((section) => (
        <SellerScreenSectionCard key={section.title} section={section} />
      ))}
    </>
  );
}

function SellerContent({ screen }: { screen: SellerScreenConfig }) {
  const layoutClassName = screen.rail ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid gap-6';

  return (
    <div className={layoutClassName}>
      <div className="grid gap-6">
        <SellerScreenSections sections={screen.sections} />
      </div>
      {screen.rail && (
        <aside className="grid content-start gap-6">
          <SellerScreenSections sections={screen.rail} />
        </aside>
      )}
    </div>
  );
}

export function SellerScreen({ screen, storeId }: { screen: SellerScreenConfig; storeId: string }) {
  return (
    <div dir="rtl" lang="ar" className="mx-auto grid max-w-7xl gap-6 text-right">
      <SellerHeader screen={screen} storeId={storeId} />
      <SellerScreenMetrics metrics={screen.metrics} />
      <SellerContent screen={screen} />
    </div>
  );
}
