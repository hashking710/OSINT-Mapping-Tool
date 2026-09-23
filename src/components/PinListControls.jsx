import { useState } from 'react';
import { PIN_SORT_OPTIONS } from '../utils/pinOrder.js';

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
