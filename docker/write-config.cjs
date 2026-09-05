const fs = require('node:fs');

const config = {
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    mapId: process.env.GOOGLE_MAPS_MAP_ID || '',
  },
};

fs.writeFileSync(
  process.env.CONFIG_PATH,
  `${JSON.stringify(config, null, 2)}\n`,
);