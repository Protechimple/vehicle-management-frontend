import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

function fileDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function PrintCell({ value }) {
  if (!Array.isArray(value)) return value;
  return value.filter(Boolean).map((line, index) => (
    <span key={index} className={index ? 'block text-neutral-600' : 'block'}>
      {line}
    </span>
  ));
}

// One page setup for every printed report, used only while a report is being printed. It is the document's
// default page, not a named page, so no browser starts a separate (blank, differently oriented) page before it.
// Portrait A4 is what phones, laptops and printers use by default, so nothing gets turned on its side.
const PAGE_STYLE = '@page { size: A4 portrait; margin: 12mm 10mm; }';
const PRINTING_CLASS = 'printing-report';

// A section's table. Columns may set a `width` (e.g. '10%'): the table then keeps those widths and text wraps
// only between words, so every value stays inside its own column. Without widths the table sizes itself.
// A section may set `continuesBelow(row)`: true leaves out the line under that row, so several rows read as one record
// (then `count` gives how many records the heading shows). A column's `rowSpan(row)` stretches its cell down over
// that many rows; 0 leaves the cell out because one above covers it.
function PrintTable({ section }) {
  const fixed = section.columns.some((column) => column.width);
  const cellClass = (column) => {
    const right = column.align === 'right';
    if (fixed) return `px-1 py-1 align-top wrap-break-word ${right ? 'text-right tabular-nums' : ''}`;
    return `px-1 py-1 align-top wrap-anywhere ${right ? 'text-right tabular-nums whitespace-nowrap' : ''}`;
  };
  return (
    <table className={`w-full border-collapse ${fixed ? 'table-fixed' : 'table-auto'}`}>
      {fixed && (
        <colgroup>
          {section.columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
      )}
      <thead className="[display:table-header-group]">
        <tr className="border-b border-black">
          {section.columns.map((column) => (
            <th key={column.key} scope="col" className={`px-1 py-1 align-bottom font-semibold ${fixed ? 'wrap-break-word' : ''} ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {section.rows.length === 0 ? (
          <tr>
            <td colSpan={section.columns.length} className="px-1.5 py-3 text-center text-neutral-600">
              {section.emptyMessage}
            </td>
          </tr>
        ) : (
          section.rows.map((row) => (
            <tr key={section.getRowKey(row)} className={`break-inside-avoid ${section.continuesBelow?.(row) ? '' : 'border-b border-neutral-300'}`}>
              {section.columns.map((column) => {
                const span = column.rowSpan ? column.rowSpan(row) : 1;
                if (span === 0) return null;
                return (
                  <td key={column.key} rowSpan={span > 1 ? span : undefined} className={cellClass(column)}>
                    <PrintCell value={column.render(row)} />
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// What a printed report shows. Kept apart from the printing itself so the layout can be checked on its own.
export function PrintReportContent({ report, organizationName, userName, logoUrl }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 max-w-40 object-contain" />}
          <div>
            <p className="text-base font-bold wrap-break-word">{organizationName}</p>
            <h1 className="text-sm font-semibold">{report.title}</h1>
          </div>
        </div>
        <div className="shrink-0 text-right text-neutral-600">
          <p>Generated {report.generatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {userName && <p>by {userName}</p>}
        </div>
      </header>

      {report.filters.length ? (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {report.filters.map((filter) => (
            <div key={filter.label} className="flex gap-1">
              <dt className="font-semibold">{filter.label}:</dt>
              <dd>{filter.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-neutral-600">No filters applied.</p>
      )}

      {report.summary && (
        <dl className="mt-3 flex flex-wrap gap-3">
          {report.summary.map((item) => (
            <div key={item.label} className="border border-neutral-300 px-3 py-2">
              <dt className="text-[10px] font-semibold tracking-wide text-neutral-600 uppercase">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {report.sections.map((section) => (
        <section key={section.title} className="mt-4">
          <h2 className="mb-1 text-xs font-semibold">
            {section.title} ({section.count ?? section.rows.length})
          </h2>
          <PrintTable section={section} />
        </section>
      ))}
    </>
  );
}

function PrintDocument({ report, onDone }) {
  const { user, organization } = useAuth();
  const { logoUrl } = useBranding();
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const previousTitle = document.title;
    const root = document.documentElement;
    const pageStyle = document.createElement('style');
    pageStyle.setAttribute('data-print-report-page', '');
    pageStyle.textContent = PAGE_STYLE;
    document.head.appendChild(pageStyle);
    // A class on <html> hides the app while printing; it works in browsers without :has() support too.
    root.classList.add(PRINTING_CLASS);

    const finish = () => onDone();
    const images = [...ref.current.querySelectorAll('img')];
    Promise.all(images.map((image) => image.decode().catch(() => {}))).then(() => {
      if (cancelled) return;
      document.title = `${report.title} ${fileDate(report.generatedAt)}`;
      window.print();
      // Phones return from print() straight away and build the PDF later, sometimes announcing "afterprint"
      // before they have read the page. So the report stays until the person next uses this page.
      timer = setTimeout(() => {
        window.addEventListener('pointerdown', finish, { once: true });
        window.addEventListener('keydown', finish, { once: true });
      }, 0);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', finish);
      pageStyle.remove();
      root.classList.remove(PRINTING_CLASS);
      document.title = previousTitle;
    };
  }, [report, onDone]);

  return createPortal(
    <div ref={ref} data-print-report className="hidden w-full max-w-full bg-white text-[10px] leading-snug text-black print:block">
      <PrintReportContent report={report} organizationName={organization?.organizationName} userName={user?.name} logoUrl={logoUrl} />
    </div>,
    document.body
  );
}

export default function PrintReportButton({ buildReport, onError }) {
  const [report, setReport] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const clearReport = useCallback(() => setReport(null), []);

  async function handleClick() {
    onError(null);
    setPreparing(true);
    try {
      const generatedAt = new Date();
      setReport({ ...(await buildReport(generatedAt)), generatedAt });
    } catch (err) {
      onError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <>
      <Button variant="secondary" loading={preparing} onClick={handleClick} title="Opens the print dialog — choose Save as PDF to download">
        Print / Download
      </Button>
      {report && <PrintDocument report={report} onDone={clearReport} />}
    </>
  );
}
