import { useRef } from 'react';
import { getMapIconSrc } from '../mapIcons.js';
import { PIN_COLORS, getPinColor } from '../pinColors.js';
import { PinLabelFilter, PinSortSelect } from './PinListControls.jsx';
import { SidebarTitle } from './SidebarToggle.jsx';

const pinDisplayLabel = (pin) => pin.label?.trim() || pin.address?.trim() || 'Unnamed pin';

function pinSecondaryLabel(pin) {
  if (pin.label && pin.address) return pin.address;
  return `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`;
}

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// Preset swatches plus a custom colour, for the line joining pins.
function ConnectorColors({ mapDisplay, onChange }) {
  const customInputRef = useRef(null);
  const current = mapDisplay.pinConnectionColor ?? '';
  const presets = Object.values(PIN_COLORS);
  const isCustom = current && !presets.some((c) => c.bg.toLowerCase() === current.toLowerCase());

  return (
    <div className="map-connect-colors">
      {presets.map((c) => (
        <button
          key={c.bg}
          type="button"
          className={`map-connect-swatch ${current.toLowerCase() === c.bg.toLowerCase() ? 'selected' : ''}`}
          style={{ background: c.bg, borderColor: c.border }}
          onClick={() => onChange({ pinConnectionColor: c.bg })}
          aria-label={`Line color: ${c.name}`}
          title={c.name}
        />
      ))}
      <button
        type="button"
        className={`map-connect-swatch color-swatch-custom ${isCustom ? 'selected' : ''}`}
        style={isCustom ? { background: current } : undefined}
        onClick={() => customInputRef.current?.click()}
        aria-label="Custom line color"
        title="Custom color"
      />
      <input
        ref={customInputRef}
        type="color"
        className="color-input-hidden"
        value={isCustom ? current : '#ef4444'}
        onChange={(e) => onChange({ pinConnectionColor: e.target.value })}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

function PinRow({ pin, number, highlighted, dnd, onOpen, onDelete }) {
  const colors = getPinColor(pin.color);
  // Pick the icon variant that contrasts with the pin's colour (not the app
  // theme), since the badge background is the pin colour.
  const iconSrc = getMapIconSrc(pin.iconId, colors.glyph === '#ffffff' ? 'dark' : 'light');
  return (
    <li
      className={`pin-item ${highlighted ? 'highlighted' : ''} ${dnd.classFor(pin)}`}
      {...dnd.bind(pin)}
      onClick={() => onOpen(pin)}
    >
      {iconSrc ? (
        <div className="pin-index pin-index-icon" style={{ background: colors.bg, borderColor: colors.border }}>
          <img src={iconSrc} alt="" draggable={false} />
          <span className="pin-index-num" style={{ background: colors.glyph, color: colors.bg, borderColor: colors.bg }}>
            {number}
          </span>
        </div>
      ) : (
        <div className="pin-index" style={{ background: colors.bg, color: colors.glyph, borderColor: colors.border }}>
          {number}
        </div>
      )}
      <div className="pin-body">
        <div className="pin-label">{pinDisplayLabel(pin)}</div>
        <div className="pin-secondary">{pinSecondaryLabel(pin)}</div>
      </div>
      <button
        type="button"
        className="pin-delete"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${pinDisplayLabel(pin)}"?`)) onDelete(pin.id);
        }}
        aria-label="Delete pin"
        title="Delete pin"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </li>
  );
}

// The Locations sidebar shared by the OpenStreetMap and Google map tabs:
// search, sort, label filter, fit/connect controls and the pin list.
export default function PinSidebar({
  pins,
  visiblePins,
  pinNumbers,
  pinDrag,
  highlightedPinIds,
  collapsed,
  onToggleCollapsed,
  onOpenSettings,
  query,
  onQueryChange,
  sort,
  onSortChange,
  labelFilter,
  onFitAll,
  mapDisplay,
  onMapDisplayChange,
  onOpenPin,
  onDeletePin,
}) {
  const connectionsOn = !!mapDisplay.showPinConnections;
  return (
    <aside className={`map-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <SidebarTitle title="Locations" count={pins.length} collapsed={collapsed} onToggle={onToggleCollapsed} />
        <button className="icon-btn" onClick={onOpenSettings} title="Map settings" aria-label="Map settings">
          <GearIcon />
        </button>
      </div>

      <div className="map-display-controls">
        <div className="map-search-wrap">
          <input
            type="search"
            className="map-search-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search pins"
            aria-label="Search pins"
          />
        </div>
        {pins.length > 1 && <PinSortSelect value={sort} onChange={onSortChange} />}
        <PinLabelFilter filter={labelFilter} />
        {pins.length > 0 && (
          <button type="button" className="map-connect-toggle" onClick={onFitAll} title="Zoom the map to show every pin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            Show all pins
          </button>
        )}
        <button
          type="button"
          className={`map-connect-toggle ${connectionsOn ? 'active' : ''}`}
          onClick={() => onMapDisplayChange({ showPinConnections: !connectionsOn })}
          aria-pressed={connectionsOn}
          title={connectionsOn ? 'Hide pin connections' : 'Show pin connections'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3">
            <line x1="3" y1="20" x2="21" y2="4" />
          </svg>
          Connect pins
        </button>
        {connectionsOn && <ConnectorColors mapDisplay={mapDisplay} onChange={onMapDisplayChange} />}
      </div>

      {pins.length === 0 ? (
        <div className="empty-state">
          <p>No pinned locations yet.</p>
          <p className="empty-hint">Click anywhere on the map to drop a pin.</p>
        </div>
      ) : visiblePins.length === 0 ? (
        <div className="empty-state">
          <p>No matching pins.</p>
          <p className="empty-hint">Try a different label, address, or note.</p>
        </div>
      ) : (
        <ul className="pin-list">
          {visiblePins.map((pin) => (
            <PinRow
              key={pin.id}
              pin={pin}
              number={pinNumbers.get(pin.id)}
              highlighted={highlightedPinIds.has(pin.id)}
              dnd={pinDrag}
              onOpen={onOpenPin}
              onDelete={onDeletePin}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
