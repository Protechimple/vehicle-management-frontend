import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { centringApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table, Tabs } from '../../components/ui';
import Can from '../../components/Can';
import useLastValidPage from '../../hooks/useLastValidPage';

const textareaClasses =
  'w-full rounded border border-steel-200 bg-surface px-3 py-2 text-base text-steel-900 sm:text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none';

// Loads the active categories, sub categories and units, to pick from.
function useActive(api, deps = []) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    listAll(api.list)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// The five lists. Each says what it shows, how its form looks, and what it sends.

const TABS = {
  categories: {
    label: 'Categories',
    api: centringApi.categories,
    noun: 'category',
    hint: 'Main groups, e.g. Plates, Props.',
    empty: 'No categories yet. Start here: add your first category, e.g. Plates.',
    columns: [{ key: 'categoryName', label: 'Category', render: (r) => <span className="font-semibold text-steel-900">{r.categoryName}</span> }],
    blank: () => ({ categoryName: '' }),
    fromRecord: (r) => ({ categoryName: r.categoryName }),
    fields: [{ name: 'categoryName', label: 'Category name', required: true, placeholder: 'e.g. Plates', max: 100 }],
  },
  subCategories: {
    label: 'Sub Categories',
    api: centringApi.subCategories,
    noun: 'sub category',
    hint: 'Groups inside a category, e.g. MS Plate.',
    empty: 'No sub categories yet. Add one under each category.',
    filterByCategory: true,
    columns: [
      { key: 'subCategoryName', label: 'Sub category', render: (r) => <span className="font-semibold text-steel-900">{r.subCategoryName}</span> },
      { key: 'categoryName', label: 'Category' },
    ],
    blank: () => ({ categoryId: '', subCategoryName: '' }),
    fromRecord: (r) => ({ categoryId: String(r.categoryId), subCategoryName: r.subCategoryName }),
    fields: [
      { name: 'categoryId', label: 'Category', required: true, type: 'category' },
      { name: 'subCategoryName', label: 'Sub category name', required: true, placeholder: 'e.g. MS Plate', max: 100 },
    ],
  },
  units: {
    label: 'Units of Measure',
    api: centringApi.units,
    noun: 'unit',
    hint: 'How an item is counted, e.g. Nos, Sqm.',
    empty: 'No units yet. Add the units you measure centring material in, e.g. Nos, Sqm, Rmt.',
    columns: [{ key: 'unitName', label: 'Unit', render: (r) => <span className="font-semibold text-steel-900">{r.unitName}</span> }],
    blank: () => ({ unitName: '' }),
    fromRecord: (r) => ({ unitName: r.unitName }),
    fields: [{ name: 'unitName', label: 'Unit name', required: true, placeholder: 'e.g. Nos', max: 20 }],
  },
  items: {
    label: 'Items',
    api: centringApi.items,
    noun: 'item',
    hint: 'The actual material, e.g. MS Plate 600x600.',
    empty: 'No items yet. Add the material you keep, under its sub category.',
    filterByCategory: true,
    columns: [
      { key: 'itemName', label: 'Item', render: (r) => <span className="font-semibold text-steel-900">{r.itemName}</span> },
      { key: 'categoryName', label: 'Category' },
      { key: 'subCategoryName', label: 'Sub category' },
      { key: 'unit', label: 'Unit' },
    ],
    blank: () => ({ subCategoryId: '', itemName: '', unit: '' }),
    fromRecord: (r) => ({ subCategoryId: String(r.subCategoryId), itemName: r.itemName, unit: r.unit }),
    fields: [
      { name: 'subCategoryId', label: 'Category › Sub category', required: true, type: 'subCategory' },
      { name: 'itemName', label: 'Item name', required: true, placeholder: 'e.g. MS Plate 600 x 600', max: 150 },
      { name: 'unit', label: 'Unit', required: true, type: 'unit' },
    ],
  },
  suppliers: {
    label: 'Suppliers',
    api: centringApi.suppliers,
    noun: 'supplier',
    hint: 'Who you buy material from.',
    empty: 'No suppliers yet. Add the suppliers you buy from.',
    columns: [
      { key: 'supplierName', label: 'Supplier', render: (r) => <span className="font-semibold text-steel-900">{r.supplierName}</span> },
      { key: 'contactPerson', label: 'Contact person', render: (r) => r.contactPerson ?? '—' },
      { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
      { key: 'gstNumber', label: 'GST no.', render: (r) => r.gstNumber ?? '—' },
    ],
    blank: () => ({ supplierName: '', contactPerson: '', phone: '', gstNumber: '', address: '' }),
    fromRecord: (r) => ({ supplierName: r.supplierName, contactPerson: r.contactPerson ?? '', phone: r.phone ?? '', gstNumber: r.gstNumber ?? '', address: r.address ?? '' }),
    fields: [
      { name: 'supplierName', label: 'Supplier name', required: true, max: 150 },
      { name: 'contactPerson', label: 'Contact person', max: 100 },
      { name: 'phone', label: 'Phone', max: 30, inputMode: 'tel' },
      { name: 'gstNumber', label: 'GST no.', max: 20 },
      { name: 'address', label: 'Address', type: 'textarea', max: 500 },
    ],
  },
};

const TAB_LIST = Object.entries(TABS).map(([value, t]) => ({ value, label: t.label }));

// ---------------------------------------------------------------------------------------------------------------------

function CatalogForm({ config, record, categories, subCategories, units, onClose, onSaved }) {
  const [form, setForm] = useState(record ? config.fromRecord(record) : config.blank());
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (name) => (event) => {
    setForm((f) => ({ ...f, [name]: event.target.value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    const next = {};
    for (const f of config.fields) if (f.required && !String(form[f.name] ?? '').trim()) next[f.name] = `Enter the ${f.label.toLowerCase()}.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]));
      const response = record ? await config.api.update(record.id, payload) : await config.api.create(payload);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function control(f, { id, invalid, describedBy }) {
    const common = { id, invalid, describedBy, value: form[f.name] ?? '', onChange: set(f.name) };
    if (f.type === 'category') {
      return (
        <Select {...common}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} data-added={c.id}>
              {c.categoryName}
            </option>
          ))}
        </Select>
      );
    }
    if (f.type === 'subCategory') {
      return (
        <Select {...common}>
          <option value="">Select a sub category</option>
          {subCategories.map((s) => (
            <option key={s.id} value={s.id} data-added={s.id}>
              {`${s.categoryName} › ${s.subCategoryName}`}
            </option>
          ))}
        </Select>
      );
    }
    if (f.type === 'unit') {
      // An item being edited keeps its unit in the list even if that unit has since been archived.
      const names = units.map((u) => u.unitName);
      if (record?.unit && !names.includes(record.unit)) names.push(record.unit);
      return (
        <Select {...common}>
          <option value="">Select a unit</option>
          {names.map((name) => (
            <option key={name} value={name} data-added={name}>
              {name}
            </option>
          ))}
        </Select>
      );
    }
    if (f.type === 'textarea') return <textarea id={id} rows={2} maxLength={f.max} value={common.value} onChange={common.onChange} className={textareaClasses} />;
    return <Input {...common} maxLength={f.max} placeholder={f.placeholder} inputMode={f.inputMode} />;
  }

  const missing =
    (config.fields.some((f) => f.type === 'category') && categories.length === 0 && 'Add a category first (Categories tab).') ||
    (config.fields.some((f) => f.type === 'subCategory') && subCategories.length === 0 && 'Add a sub category first (Sub Categories tab).') ||
    (config.fields.some((f) => f.type === 'unit') && units.length === 0 && !record && 'Add a unit first (Units of Measure tab).');

  return (
    <Modal open onClose={onClose} title={record ? `Edit ${config.noun}` : `Add ${config.noun}`}>
      <form onSubmit={submit} noValidate>
        <Alert tone="error">{error}</Alert>
        <Alert tone="warning">{missing || null}</Alert>
        {config.fields.map((f) => (
          <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]}>
            {(p) => control(f, p)}
          </Field>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={Boolean(missing)}>
            {record ? 'Save changes' : `Add ${config.noun}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CatalogTab({ tabKey }) {
  const config = TABS[tabKey];
  const [filters, setFilters] = useState({ search: '', status: '', categoryId: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const categories = useActive(centringApi.categories, [refreshKey]);
  const subCategories = useActive(centringApi.subCategories, [refreshKey]);
  const units = useActive(centringApi.units, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setError(null);
      config.api
        .list({ search: filters.search || undefined, status: filters.status || undefined, categoryId: filters.categoryId || undefined, page: filters.page })
        .then((r) => !cancelled && setResult(r))
        .catch((err) => !cancelled && setError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, filters, refreshKey]);

  useLastValidPage(result, filters.page, setFilters);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const changed = (message) => {
    setNotice(message);
    setEditing(null);
    setRefreshKey((k) => k + 1);
  };

  async function toggle(record) {
    setBusyId(record.id);
    setError(null);
    try {
      const response = record.status === 'active' ? await config.api.archive(record.id) : await config.api.restore(record.id);
      changed(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    ...config.columns,
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'archived' ? 'neutral' : 'success'}>{r.status}</Badge> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <Can resource="CENTRING" action="MANAGE_CATALOG">
          <div className="flex justify-end gap-2">
            {r.status === 'active' && (
              <Button size="sm" variant="secondary" onClick={() => setEditing({ record: r })}>
                Edit
              </Button>
            )}
            <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => toggle(r)}>
              {r.status === 'active' ? 'Archive' : 'Restore'}
            </Button>
          </div>
        </Can>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel-600">{config.hint}</p>
        <Can resource="CENTRING" action="MANAGE_CATALOG">
          <Button onClick={() => setEditing({})}>Add {config.noun}</Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${config.filterByCategory ? 'lg:grid-cols-3' : ''} lg:max-w-4xl`}>
        <Input placeholder="Search…" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        {config.filterByCategory && (
          <Select aria-label="Category" value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} data-added={c.id}>
                {c.categoryName}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label={`Loading ${config.label.toLowerCase()}`} />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              emptyMessage={filters.search || filters.categoryId ? 'Nothing matches your search.' : filters.status ? `No archived ${config.label.toLowerCase()}.` : config.empty}
            />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      {editing && (
        <CatalogForm config={config} record={editing.record} categories={categories} subCategories={subCategories} units={units} onClose={() => setEditing(null)} onSaved={changed} />
      )}
    </>
  );
}

export default function CentringCatalogPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'categories';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Centring Catalog</h1>
        <p className="mt-1 text-steel-500">Add in this order: Categories → Sub Categories → Units → Items. Suppliers any time.</p>
      </div>
      <Tabs tabs={TAB_LIST} active={tab} onChange={(value) => setParams({ tab: value }, { replace: true })} />
      <CatalogTab key={tab} tabKey={tab} />
    </div>
  );
}
