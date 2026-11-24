const keyOf = (resource, action) => `${resource}:${action}`;

// The fixed columns. View covers both READ and VIEW; anything not listed goes in "Other".
const COLUMNS = [
  { label: 'View', actions: ['READ', 'VIEW'] },
  { label: 'Create', actions: ['CREATE'] },
  { label: 'Edit', actions: ['UPDATE'] },
  { label: 'Delete', actions: ['DELETE'] },
  { label: 'Restore', actions: ['RESTORE'] },
];
const COLUMN_ACTIONS = new Set(COLUMNS.flatMap((c) => c.actions));

// Applies one toggle and keeps the screen consistent: an action needs View, and taking View away takes the rest.
export function applyToggle(resourceDef, action, nextAllowed, effective) {
  const changes = {};
  const { resource, viewAction, actions } = resourceDef;
  changes[keyOf(resource, action)] = nextAllowed;

  if (action === viewAction && !nextAllowed) {
    for (const other of actions) changes[keyOf(resource, other.action)] = false;
  }
  if (action !== viewAction && nextAllowed && viewAction && !effective(keyOf(resource, viewAction))) {
    changes[keyOf(resource, viewAction)] = true;
  }
  return changes;
}

function moduleState(module, effective) {
  const keys = module.resources.flatMap((r) => (r.viewAction ? [keyOf(r.resource, r.viewAction)] : []));
  const on = keys.filter((key) => effective(key)).length;
  return on === 0 ? 'off' : on === keys.length ? 'on' : 'partial';
}

function Check({ checked, changed, disabled, label, onChange }) {
  return (
    <label className={`relative inline-flex items-center justify-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      {changed && (
        <span
          className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-warning-600"
          title="Differs from the default"
          aria-hidden="true"
        />
      )}
    </label>
  );
}

function OtherAction({ checked, changed, disabled, label, onChange }) {
  return (
    <label
      className={[
        'relative inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap select-none',
        checked ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-steel-200 text-steel-500',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand-500',
      ].join(' ')}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--color-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
      {changed && <span className="size-1.5 rounded-full bg-warning-600" title="Differs from the default" aria-hidden="true" />}
    </label>
  );
}

/**
 * One person's or one role's access, module by module, as a table with a column per action.
 *
 * modules   – the catalog from the server: [{ key, label, resources: [{ resource, label, viewAction, actions }] }]
 * effective – (key) => boolean, what is allowed now including unsaved edits
 * baseline  – (key) => boolean, what it would be without this screen's choice (the role's default, or the role's access)
 * onChange  – ({ [key]: boolean }) => void
 */
export default function AccessMatrix({ modules, effective, baseline, onChange, disabled = false }) {
  const hasOther = modules.some((m) => m.resources.some((r) => r.actions.some((a) => !COLUMN_ACTIONS.has(a.action))));

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs text-steel-500">
        <span className="size-1.5 rounded-full bg-warning-600" aria-hidden="true" /> differs from the default
        {/* On narrow screens Delete, Restore and Other are off to the right of each table. */}
        <span className="md:hidden">· swipe a table sideways for more actions</span>
      </p>

      {modules.map((module) => {
        const state = moduleState(module, effective);
        const toggleModule = (on) => {
          const changes = {};
          for (const resourceDef of module.resources) {
            for (const { action } of resourceDef.actions) {
              const key = keyOf(resourceDef.resource, action);
              changes[key] = on ? (action === resourceDef.viewAction ? true : effective(key)) : false;
            }
          }
          onChange(changes);
        };

        return (
          <section key={module.key} className="overflow-hidden rounded border border-steel-200">
            <header className="flex items-center justify-between gap-3 border-b border-steel-200 bg-steel-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-steel-900">{module.label}</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-steel-600">
                <span className={state === 'off' ? 'text-steel-500' : 'text-success-600'}>
                  {state === 'on' ? 'Shown in menu' : state === 'off' ? 'Hidden' : 'Partly shown'}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="size-4 accent-[var(--color-accent)]"
                  checked={state !== 'off'}
                  ref={(el) => {
                    if (el) el.indeterminate = state === 'partial';
                  }}
                  disabled={disabled}
                  onChange={(event) => toggleModule(event.target.checked)}
                  aria-label={`Show ${module.label}`}
                />
              </label>
            </header>

            <div className="relative overflow-x-auto">
              {/* Fixed column widths, so every module's columns line up under each other. The minimum width leaves
                  the Screen column at least ~7.5rem on phones (the action columns alone take 37.5rem with Other). */}
              <table className={`w-full ${hasOther ? 'min-w-[45rem]' : 'min-w-[40rem]'} table-fixed text-sm`}>
                <colgroup>
                  <col />
                  {COLUMNS.map((c) => (
                    <col key={c.label} className="w-[4.5rem]" />
                  ))}
                  {hasOther && <col className="w-[15rem]" />}
                </colgroup>
                <thead>
                  <tr className="border-b border-steel-200 text-[11px] font-semibold tracking-wide text-steel-500 uppercase">
                    <th scope="col" className="px-4 py-2 text-left">
                      Screen
                    </th>
                    {COLUMNS.map((c) => (
                      <th key={c.label} scope="col" className="px-2 py-2 text-center">
                        {c.label}
                      </th>
                    ))}
                    {hasOther && (
                      <th scope="col" className="px-4 py-2 text-left">
                        Other
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {module.resources.map((resourceDef) => {
                    const byAction = new Map(resourceDef.actions.map((a) => [a.action, a]));
                    const cell = (action, label, Component = Check) => {
                      const key = keyOf(resourceDef.resource, action);
                      const checked = effective(key);
                      return (
                        <Component
                          key={action}
                          label={label}
                          checked={checked}
                          changed={checked !== baseline(key)}
                          disabled={disabled}
                          onChange={(next) => onChange(applyToggle(resourceDef, action, next, effective))}
                        />
                      );
                    };
                    const others = resourceDef.actions.filter((a) => !COLUMN_ACTIONS.has(a.action));

                    return (
                      <tr key={resourceDef.resource} className="hover:bg-steel-50">
                        <th scope="row" className="px-4 py-2.5 text-left font-normal text-steel-800">
                          {resourceDef.label}
                        </th>
                        {COLUMNS.map((c) => {
                          const action = c.actions.find((a) => byAction.has(a));
                          return (
                            <td key={c.label} className="px-2 py-2.5 text-center">
                              {action ? cell(action, `${c.label} ${resourceDef.label}`) : <span className="text-steel-300" aria-hidden="true">—</span>}
                            </td>
                          );
                        })}
                        {hasOther && (
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1.5">{others.map((a) => cell(a.action, a.label, OtherAction))}</div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
