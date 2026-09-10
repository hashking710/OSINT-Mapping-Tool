# OSINT Mapping Tool

A local-first OSINT workspace for organizing targets, evidence, and location-based research without sending your data anywhere.

[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL%203.0-green)](LICENSE)
[![Local-first](https://img.shields.io/badge/Local--first-✓-success)](#privacy-and-storage)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/hashking)

> Built for research, investigations, and field notes. Everything stays on your machine unless you deliberately choose to export or share a project file.

---

## Overview

OSINT Mapping Tool helps you organize a target into a structured digital case file:

- capture identifiers, contacts, personas, vehicles, and other lead data
- link those records together visually in a graph
- pin places to a map and connect them back to the people or entities tied to them
- store findings in a local project file with notes and evidence trails
- optionally enrich data with public-source lookups and RapidAPI providers

The app is designed to be practical for research work without forcing cloud storage or account creation.

## Why this tool

This project is meant for people who want a clean, private research workspace instead of a bloated social-media dashboard or a locked SaaS product.

- Privacy-first: no backend, no account required, no forced cloud sync
- Portable: save and reopen project files as plain JSON
- Flexible: use Google Maps or OpenStreetMap
- Visual: connect identifiers and places in a way that makes investigation patterns obvious
- Evidence-minded: notes, links, and public-source enrichments are kept with the project

## Screenshots

![Landing screen](./readme_images/Example1.png)

![Map and project workspace](./readme_images/Example2.png)

![Kinahan-style investigation preview](./readme_images/Example3.png)

![OSINT API demonstration workflow](./readme_images/Example5.png)

## Recommended OSINT data sources

This project is intentionally flexible and works well with a layered OSINT stack. The most useful sources for a local-first workflow are:

### High-value identity and contact sources

- People Data Labs — identity resolution and person enrichment
- Clearbit — company and professional contact enrichment
- Hunter.io — email discovery and verification
- Numverify — phone validation and country/line metadata
- Social Lookup — username and account-presence checks

### Infrastructure and network intelligence

- SecurityTrails — DNS, domain, and infrastructure discovery
- Shodan — exposed devices and internet-facing infrastructure
- Censys — certificate and service discovery for internet-facing assets
- AbuseIPDB — IP risk and reputation context
- VirusTotal — malicious URL and domain reputation checks
- ThreatFox — malicious domain and IOC context

### Mapping, geolocation, and place context

- Geoapify — geocoding, reverse geocoding, and POI context
- Nominatim / OpenStreetMap — address geocoding and open geographic reference data
- Google Maps / Places — location metadata, ratings, business context, and map views
- OpenStreetMap — free map base for local-first mapping and place overlays

### Public records, company, and reference data

- OpenAlex — publications, institutions, and research references
- Wikidata — structured entity knowledge for people, organisations, events, and networks
- Wikipedia — public reference summaries and narrative context
- OpenCorporates — company and corporate-structure lookups
- Public record and court / registry sources — jurisdictional person, business, and ownership context

### Optional advanced or niche sources

- ZoomEye — internet asset discovery and exposed services
- IntelX — structured intelligence and IOC pivoting
- Bellingcat-style public-source datasets — investigative public records, news archives, and reference materials
- OSINT social, forum, and archive sources — public profile, community, and event context

These are not required for the app to run. They are genuinely useful enrichment sources that fit a structured, user-controlled investigative workflow and can be turned on or off intentionally depending on the case.

### Resource library approach

This app is built to support a layered investigation workflow rather than a single-source lookup model:

- identity / contact lookups for people, accounts, and email signals
- infrastructure checks for domains, IPs, and exposed services
- map and place enrichment for geolocation and movement patterns
- public records and entity references for context and corroboration
- risk and reputation checks for suspicious links, infrastructure, and network indicators

That makes it useful for both structured case-building and exploratory public-source research.

## Features

### Information graph

Create nodes for people, accounts, emails, phones, vehicles, social handles, and any other research artifact.

- drag connections between nodes
- quick-add new nodes from empty space
- link pins, notes, and context to the relevant identity
- customize icons and colors for each type

### Map workspace

Pin locations with context, notes, and linked identifiers.

- choose Google Maps or OpenStreetMap
- search by location when useful
- add pins with labels, visited date, notes, and people involved
- connect pins and identities across your research board

### Public-data enrichment

Optional enrichment tools can help add context from public sources and supported RapidAPI providers while keeping the workflow explicit and user-controlled.

- look up public records when relevant
- add evidence notes and provenance to the project
- use provider toggles only when you intentionally enable them

## Getting started

Requirements:

- Node.js 18+
- npm

```bash
git clone https://github.com/hashking710/OSINT-Mapping-Tool.git
cd OSINT-Mapping-Tool
npm install
npm run dev
```

Then open:

<http://localhost:5173>

Build a production bundle:

```bash
npm run build
npm run preview
```

## Optional Google Maps setup

If you want the richer Google Maps experience, add your API key in the app settings or in a local config file.

```bash
cp public/app.config.example.json public/app.config.json
```

Then fill in your values:

```json
{
  "googleMaps": {
    "apiKey": "YOUR_KEY_HERE",
    "mapId": "YOUR_MAP_ID"
  }
}
```

The local browser config is preferred, and the file is meant to stay local to your machine.

## Privacy and storage

This project is intentionally local-first:

- project files live on your device
- settings are stored in the browser
- no remote sync is required
- no analytics or backend data collection is built into the app

You are in control of what you save, what you share, and how long you keep it.

## Support the project

If you want to support ongoing development, you can buy a coffee or contribute toward the project’s maintenance and feature work.

[Ko-fi](https://ko-fi.com/hashking)

## License

This project is licensed under the GPL-3.0 license.

See [LICENSE](LICENSE) for details.

## Project structure

```text
src/
  components/
  context/
  styles/
  utils/
  App.jsx
  main.jsx
public/
  app.config.example.json
readme_images/
  Example1.png
  Example2.png
  Example3.png
  Example5.png
```
