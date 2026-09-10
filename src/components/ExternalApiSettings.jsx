import { useMemo, useState } from 'react';
import { RAPID_API_PROVIDER_LIBRARY, getEnabledRapidApiProviders } from '../utils/externalApis.js';
import { writeLocalConfig } from '../utils/appConfig.js';

export default function ExternalApiSettings() {
  const [rapidApiKey, setRapidApiKey] = useState(() => {
    const raw = localStorage.getItem('osint-tool:app-config');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.externalApis?.rapidApiKey === 'string' ? parsed.externalApis.rapidApiKey : '';
    } catch {
      return '';
    }
  });

  const [providers, setProviders] = useState(() => {
    const raw = localStorage.getItem('osint-tool:app-config');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.externalApis?.providers ?? {};
    } catch {
      return {};
    }
  });

  const providerGroups = useMemo(() => {
    const groups = {};
    for (const [providerId, provider] of Object.entries(RAPID_API_PROVIDER_LIBRARY)) {
      const group = provider.category || 'other';
      if (!groups[group]) groups[group] = [];
      groups[group].push({ providerId, provider });
    }
    return Object.entries(groups).map(([label, items]) => ({
      label,
      items: items.sort((a, b) => a.provider.name.localeCompare(b.provider.name)),
    }));
  }, []);

  const enabledProviders = useMemo(() => getEnabledRapidApiProviders({ externalApis: { providers } }), [providers]);

  const handleRapidApiKeySave = () => {
    const next = (rapidApiKey ?? '').trim();
    writeLocalConfig({ externalApis: { rapidApiKey: next } });
  };

  const toggleProvider = (providerId) => {
    const next = {
      ...providers,
      [providerId]: {
        ...(providers[providerId] ?? {}),
        enabled: !Boolean(providers[providerId]?.enabled),
      },
    };
    setProviders(next);
    writeLocalConfig({ externalApis: { providers: next } });
  };

  return (
    <div className="settings-current">
      <div className="settings-row">
        <span className="settings-label">RapidAPI key</span>
      </div>
      <input
        type="password"
        className="settings-input"
        value={rapidApiKey}
        onChange={(event) => setRapidApiKey(event.target.value)}
        placeholder="Enter a RapidAPI key"
      />
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" onClick={handleRapidApiKeySave}>
          Save RapidAPI key
        </button>
      </div>

      <div className="settings-row" style={{ marginTop: '1rem' }}>
        <span className="settings-label">Enabled providers</span>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {providerGroups.map(({ label, items }) => (
          <div key={label} style={{ display: 'grid', gap: '0.5rem' }}>
            <div className="provider-category-label">{label}</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {items.map(({ providerId, provider }) => {
                const enabled = Boolean(providers[providerId]?.enabled);
                return (
                  <div key={providerId} className="provider-card" style={{ display: 'grid', gap: '0.25rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                      <span>{provider.name}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleProvider(providerId)}
                      />
                    </label>
                    <small style={{ opacity: 0.8 }}>{provider.description}</small>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="settings-hint">
        Enabled providers are optional public-source enrichments. They never alter the project unless you explicitly choose to use a source.
      </p>
      {enabledProviders.length > 0 && (
        <p className="settings-hint">
          Active: {enabledProviders.join(', ')}
        </p>
      )}
    </div>
  );
}
