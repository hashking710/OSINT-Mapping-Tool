import { lazy, Suspense } from 'react';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import MapsKeySetup from './MapsKeySetup.jsx';
import './MapTab.css';

const MapTabGoogle = lazy(() => import('./MapTabGoogle.jsx'));
const MapTabOSM = lazy(() => import('./MapTabOSM.jsx'));

function MapLoading() {
  return (
    <div className="map-tab">
      <div className="map-loading">Loading map…</div>
    </div>
  );
}

export default function MapTab({ visible = true }) {
  const { loaded, googleMapsApiKey, mapProvider } = useAppConfig();

  if (!loaded) return <MapLoading />;

  if (mapProvider === 'osm') {
    return (
      <Suspense fallback={<MapLoading />}>
        <MapTabOSM visible={visible} />
      </Suspense>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="map-tab">
        <MapsKeySetup />
      </div>
    );
  }

  return (
    <Suspense fallback={<MapLoading />}>
      <MapTabGoogle />
    </Suspense>
  );
}
