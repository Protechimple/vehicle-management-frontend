// Shown in an empty date/time field on iPhone/iPad, where Safari draws it as a blank box with no dd/mm/yyyy.
const EMPTY_PICKER_HINT = {
  date: 'Select date',
  time: 'Select time',
  'datetime-local': 'Select date & time',
  month: 'Select month',
};

export default function Input({ invalid = false, describedBy, className = '', ...props }) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={[
        // 16px on phones so iOS doesn't zoom the page when a search box is focused.
        'w-full rounded border bg-surface px-3 py-1.5 text-base text-steel-900 sm:text-sm',
        'placeholder:text-steel-300 focus:outline-none focus:ring-2',
        'disabled:cursor-not-allowed disabled:bg-steel-50',
        invalid
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30'
          : 'border-steel-200 focus:border-brand-600 focus:ring-brand-600/25',
        className,
      ].join(' ')}
      {...props}
    />
  );

  const pickerHint = EMPTY_PICKER_HINT[props.type];
  if (!pickerHint) return input;

  // Date/time fields always get this wrapper (so the field never remounts while you pick); the hint inside only
  // shows on iOS, and only while the field is empty. Other browsers already show their own dd/mm/yyyy.
  const empty = props.value === '' || props.value == null;
  return (
    <div className="relative w-full min-w-0">
      {input}
      {empty && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3.25 left-3.25 hidden items-center text-base text-steel-300 ios:flex"
        >
          <span className="truncate">{props.placeholder || props['aria-label'] || pickerHint}</span>
        </span>
      )}
    </div>
  );
}
