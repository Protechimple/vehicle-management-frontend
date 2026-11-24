import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Lists with more entries than this get a search box.
const SEARCH_THRESHOLD = 5;
// How many of the most recently added entries are listed first.
const RECENT_COUNT = 5;
const POPUP_HEIGHT = 320;
const MARGIN = 8;
const COARSE_POINTER_QUERY = '(pointer: coarse)';

const fieldClasses = (invalid) =>
  [
    'w-full rounded border bg-surface px-3 py-1.5 text-sm text-steel-900',
    'focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:bg-steel-50',
    invalid
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30'
      : 'border-steel-200 focus:border-brand-600 focus:ring-brand-600/25',
  ].join(' ');

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(node.props.children);
  return '';
}

function collectOptions(children, list = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collectOptions(child.props.children, list);
      return;
    }
    if (child.type !== 'option') return;
    const label = textOf(child.props.children);
    const value = child.props.value === undefined ? label : String(child.props.value);
    list.push({
      value,
      label,
      search: `${label} ${value}`.toLowerCase(),
      disabled: Boolean(child.props.disabled),
      added: child.props['data-added'],
      index: list.length,
    });
  });
  return list;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function compareAdded(a, b) {
  const x = Number(a.added);
  const y = Number(b.added);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return y - x || a.index - b.index;
  return String(b.added).localeCompare(String(a.added)) || a.index - b.index;
}

function matches(option, words) {
  return words.every((word) => option.search.includes(word));
}

function changeEvent(value, name, id) {
  const target = { value, name, id };
  return { target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} };
}

function isTouchScreen() {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function firstEnabled(list, from = 0, step = 1) {
  for (let i = from; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
  return -1;
}

function Dropdown({
  options,
  searchable,
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  className = '',
  'aria-label': ariaLabel,
}) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const scrollToActive = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);

  const current = value == null ? '' : String(value);
  const selected = useMemo(() => options.find((o) => o.value === current) ?? null, [options, current]);
  const blanks = useMemo(() => options.filter((o) => o.value === ''), [options]);

  const trimmed = searchable ? query.trim() : '';
  const { shown, footer, dividerAt = -1 } = useMemo(() => {
    if (!open) return { shown: [], footer: null };
    const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      const found = options.filter((option) => matches(option, words));
      return { shown: found, footer: found.length ? null : `No matches for “${trimmed}”.` };
    }
    const entries = options.filter((o) => o.value !== '');
    const dated = entries.filter((o) => hasValue(o.added));
    if (dated.length <= RECENT_COUNT) return { shown: options, footer: null };
    const recent = [...dated].sort(compareAdded).slice(0, RECENT_COUNT);
    const rest = entries.filter((o) => !recent.includes(o));
    return {
      shown: [...blanks, ...recent, ...rest],
      dividerAt: blanks.length + recent.length,
      footer: `The ${RECENT_COUNT} most recently added are shown first. Scroll to see all ${entries.length}${searchable ? ', or type to search' : ''}.`,
    };
  }, [open, trimmed, options, blanks, searchable]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Measure against the visible area so an on-screen keyboard doesn't hide the list.
    const vv = window.visualViewport;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const viewWidth = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
    const below = viewBottom - rect.bottom - MARGIN;
    const above = rect.top - viewTop - MARGIN;
    const upward = below < Math.min(POPUP_HEIGHT, 220) && above > below;
    // Never wider than the screen, so it fits on phones.
    const width = Math.min(Math.max(rect.width, searchable ? 260 : 0), viewWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(rect.left, viewWidth - MARGIN - width));
    setPosition({
      left,
      width,
      maxHeight: Math.max(120, Math.min(POPUP_HEIGHT, upward ? above : below)),
      ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [searchable]);

  function openList(initialQuery = '') {
    if (disabled) return;
    setQuery(searchable ? initialQuery : '');
    scrollToActive.current = false;
    setOpen(true);
  }

  const dismiss = useCallback(() => {
    setOpen(false);
    setQuery('');
    setPosition(null);
  }, []);

  function close(returnFocus = true) {
    dismiss();
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function choose(option) {
    if (!option || option.disabled) return;
    close();
    if (option.value !== current) onChange?.(changeEvent(option.value, name, id));
  }

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Focus the search box on open, except on touch screens, where that would pop
  // up the keyboard over the list. Without a search box the list takes focus so
  // the arrow keys work.
  const placed = position !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const target = inputRef.current && !isTouchScreen() ? inputRef.current : listRef.current;
    target?.focus({ preventScroll: true });
  }, [open, placed]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (triggerRef.current?.contains(event.target) || popupRef.current?.contains(event.target)) return;
      dismiss();
    };
    const onScroll = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      place();
    };
    const vv = window.visualViewport;
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [open, place, dismiss]);

  // Highlight the current value, but keep the list scrolled to the top so the
  // latest entries are what you see first.
  useEffect(() => {
    if (!open) return;
    const selectedIndex = trimmed ? -1 : shown.findIndex((o) => o.value === current);
    setActive(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled(shown)));
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [open, query]);

  useEffect(() => {
    if (!open || !scrollToActive.current) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function move(next) {
    if (next < 0) return;
    scrollToActive.current = true;
    setActive(next);
  }

  function jumpToLetter(letter) {
    const lower = letter.toLowerCase();
    for (let step = 1; step <= shown.length; step += 1) {
      const i = (active + step) % shown.length;
      if (!shown[i].disabled && shown[i].label.toLowerCase().startsWith(lower)) return move(i);
    }
  }

  function onTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    } else if (searchable && event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openList(event.key);
    }
  }

  function onPopupKeyDown(event) {
    const onList = event.target === listRef.current;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(firstEnabled(shown, active + 1, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(firstEnabled(shown, active - 1, -1));
    } else if (event.key === 'Enter' || (event.key === ' ' && onList)) {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === 'Escape') {
      // preventDefault also stops an enclosing <dialog> from closing.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    } else if (onList && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (searchable) {
        event.preventDefault();
        setQuery(event.key);
        inputRef.current?.focus();
      } else {
        jumpToLetter(event.key);
      }
    }
  }

  const activeOption = open ? shown[active] : null;

  return (
    // min-w-0 here and contain on the label: a long chosen label is cut short with "…" instead of stretching the
    // grid or flex row it sits in past the edge of the screen.
    <div className={`relative w-full min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`${fieldClasses(invalid)} flex items-center gap-2 text-left`}
      >
        <span className="min-w-0 flex-1 truncate [contain:inline-size]">{selected?.label ?? blanks[0]?.label ?? ''}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-steel-500">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {(required || name) && (
        // Stand-in for the native <select> so `required` validation and form
        // submission keep working. Focus is handed straight to the button.
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          disabled={disabled}
          value={current}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      )}

      {open && (
        <div
          ref={popupRef}
          onKeyDown={onPopupKeyDown}
          style={
            position
              ? { position: 'fixed', left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }
              : { position: 'fixed', visibility: 'hidden' }
          }
          className="z-50 flex flex-col overflow-hidden rounded border border-steel-200 bg-surface shadow-lg"
        >
          {searchable && (
            <div className="border-b border-steel-100 p-2">
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-label={`Search ${ariaLabel ?? 'options'}`}
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeOption ? `${baseId}-option-${active}` : undefined}
                autoComplete="off"
                placeholder="Type to search…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                // 16px on phones so iOS doesn't zoom the page when it's focused.
                className="w-full rounded border border-steel-200 px-2.5 py-1.5 text-base text-steel-900 placeholder:text-steel-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none sm:text-sm"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={!searchable && activeOption ? `${baseId}-option-${active}` : undefined}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 focus:outline-none"
          >
            {shown.map((option, index) => {
              const isSelected = option.value === current;
              const isActive = index === active;
              return (
                <li
                  key={`${option.value}-${option.index}`}
                  id={`${baseId}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                  className={[
                    'cursor-pointer px-3 py-2 text-sm',
                    index === dividerAt ? 'border-t border-steel-200' : '',
                    option.disabled ? 'cursor-not-allowed text-steel-300' : isActive ? 'bg-brand-50 text-steel-900' : 'text-steel-900',
                    isSelected ? 'font-semibold text-brand-700' : '',
                  ].join(' ')}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
          {footer && <p className="border-t border-steel-100 bg-steel-50 px-3 py-2 text-xs text-steel-500">{footer}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Drop-in replacement for <select>: pass <option> children as usual.
 *
 * Give record-backed options `data-added` (an id or timestamp that grows with
 * each new record) and the 5 most recent are listed first, followed by every
 * entry in a scrollable list. Record-backed lists and lists with more than 5
 * entries get a search box; `searchable` overrides that.
 */
export default function Select({ searchable, children, ...props }) {
  const options = collectOptions(children);
  const fromRecords = options.some((o) => hasValue(o.added));
  const entryCount = options.filter((o) => o.value !== '').length;
  return <Dropdown {...props} options={options} searchable={searchable ?? (fromRecords || entryCount > SEARCH_THRESHOLD)} />;
}
