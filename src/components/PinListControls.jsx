import { useMemo, useState } from 'react';
import { getPinColor } from '../pinColors.js';
import { PIN_SORT_OPTIONS } from '../utils/pinOrder.js';
import { collectPinLabelOptions, filterPinsByLabels } from '../utils/pinLabels.js';

export function PinSortSelect({ value, onChange }) {
  return (
    <select
      className="map-sort-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Sort pins"
      title="Sort the list (map numbering stays in custom order)"
    >
      {PIN_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// HTML5 drag-and-drop reordering for the sidebar pin list. Only active in
// custom order with no search, since reordering a sorted or filtered view
// would be ambiguous.
export function usePinDrag({ enabled, onReorder }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);

  const reset = () => {
    setDraggingId(null);
    setOverId(null);
  };

  const bind = (pin) =>
    enabled
      ? {
          draggable: true,
          onDragStart: (event) => {
            setDraggingId(pin.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', pin.id);
          },
          onDragOver: (event) => {
            if (draggingId && draggingId !== pin.id) {
              event.preventDefault();
              setOverId(pin.id);
            }
          },
          onDrop: (event) => {
            event.preventDefault();
            if (draggingId) onReorder(draggingId, pin.id);
            reset();
          },
          onDragEnd: reset,
        }
      : {};

  const classFor = (pin) =>
    `${draggingId === pin.id ? 'dragging' : ''} ${overId === pin.id ? 'drag-over' : ''}`.trim();

  return { bind, classFor };
}

// Filter pins by the tags/colours of the identifiers linked to them.
export function usePinLabelFilter(project, pins) {
  const [value, setValue] = useState({ tag: null, color: null });
  const identifiers = project?.identifiers;
  const pinLinks = project?.pinLinks;
  const options = useMemo(
    () => collectPinLabelOptions(pins, pinLinks ?? [], identifiers ?? []),
    [pins, pinLinks, identifiers],
  );
  const effective = useMemo(
    () => ({
      tag: options.tags.some((t) => t.tag.toLowerCase() === (value.tag ?? '').toLowerCase()) ? value.tag : null,
      color: options.colors.includes(value.color) ? value.color : null,
    }),
    [options, value],
  );
  const active = !!(effective.tag || effective.color);
  const matchIds = useMemo(
    () =>
      active
        ? new Set(filterPinsByLabels(pins, pinLinks ?? [], identifiers ?? [], effective).map((p) => p.id))
        : null,
    [active, pins, pinLinks, identifiers, effective],
  );
  return { options, value: effective, setValue, active, matchIds };
}

export function PinLabelFilter({ filter }) {
  const { options, value, setValue, active } = filter;
  if (options.tags.length === 0 && options.colors.length === 0) return null;
  return (
    <div className="label-filter pin-label-filter" role="group" aria-label="Filter pins by linked identifier labels">
      {options.colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`label-filter-dot ${value.color === color ? 'active' : ''}`}
          style={{ background: getPinColor(color).bg, borderColor: getPinColor(color).border }}
          aria-pressed={value.color === color}
          aria-label={`Show pins linked to ${getPinColor(color).name} identifiers`}
          onClick={() => setValue((v) => ({ ...v, color: v.color === color ? null : color }))}
        />
      ))}
      {options.tags.slice(0, 10).map(({ tag, count }) => {
        const on = value.tag?.toLowerCase() === tag.toLowerCase();
        return (
          <button
            key={tag}
            type="button"
            className={`tag-chip filterable ${on ? 'active' : ''}`}
            aria-pressed={on}
            title={`Pins linked to identifiers tagged "${tag}"`}
            onClick={() => setValue((v) => ({ ...v, tag: on ? null : tag }))}
          >
            {tag} <span className="tag-count">{count}</span>
          </button>
        );
      })}
      {active && (
        <button type="button" className="label-filter-clear" onClick={() => setValue({ tag: null, color: null })}>
          Clear
        </button>
      )}
    </div>
  );
}
