import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR = { added: '#2e9e5b', updated: '#c98a10', same: '#7d8590' };

function FitPins({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 12);
    else map.fitBounds(pins.map((p) => [p.lat, p.lng]), { padding: [24, 24], maxZoom: 14 });
  }, [map, pins]);
  return null;
}

// Small read-only map of the merged project's pins, coloured by what the merge does to them.
export default function MergePreviewMap({ pins }) {
  return (
    <div className="merge-preview-map" data-testid="merge-preview-map">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitPins pins={pins} />
        {pins.map((pin) => (
          <CircleMarker
            key={pin.id}
            center={[pin.lat, pin.lng]}
            radius={pin.status === 'same' ? 6 : 9}
            className={`mp-pin ${pin.status}`}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: STATUS_COLOR[pin.status], fillOpacity: pin.status === 'same' ? 0.65 : 0.95 }}
          >
            <Tooltip>{pin.label}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
