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

![Second case-study map view](./readme_images/Example4.png)

![OSINT API demonstration workflow](./readme_images/Example5.png)

## Available APIs and data sources

The app supports a layered OSINT workflow with both map providers and optional enrichment providers. These are not required for the base app to function, but they can be enabled intentionally when you want stronger public-source context.

### Map providers built into the app

#### Google Maps

- Google Maps JavaScript API and map tiles
- Google Places-style map workflow for richer location context and a familiar map experience
- Best when you want more polished map UX, business context, and address metadata
- Requires a Google Maps API key and optional map ID in local config

#### OpenStreetMap

- OpenStreetMap tiles, Nominatim geocoding, and Overpass place queries
- Fully local-friendly and free to use without a paid API key
- Good for investigations where you want open geographic data, place lookups, and privacy-conscious mapping

### RapidAPI providers supported by the app

These are optional enrichment sources that can be toggled in the app’s external API settings when you provide your own RapidAPI key.

#### Identity and contact intelligence

- People Data Labs — identity resolution and person/profile enrichment using names, emails, and professional signals
- Clearbit — email and company enrichment for business and professional research
- Hunter.io — email discovery and verification for organisations and people
- Numverify — phone validation, line metadata, and country-based number context
- Social Lookup — account and username presence checks across public social surfaces

#### Infrastructure and network intelligence

- SecurityTrails — DNS, hostname, infrastructure, and domain ownership intelligence
- Shodan — exposed devices and internet-facing services
- AbuseIPDB — IP reputation and abuse context
- VirusTotal — malicious URL and domain reputation checks
- ThreatFox — malicious-domain and IOC context for threat and fraud research

#### Geographic and place enrichment

- Geoapify — geocoding, reverse geocoding, and POI enrichment for place-based context
- IP Geolocation — IP-derived geolocation, ASN, ISP, and routing context

### Direct/public data sources supported

These sources are used directly from public endpoints and do not require a RapidAPI subscription in the normal workflow.

- OpenAlex — scholarly works, institutions, and publication-related references
- Wikidata — open structured knowledge graph for people, organisations, events, and networks
- Wikipedia — public reference summaries and narrative context for known entities and events
- OpenCorporates — company and corporate-structure lookups for legal and ownership research
- ThreatFox — public malware IOC and suspicious infrastructure reference data

### Investigation workflow built around those sources

The app is designed to use these sources in a layered, evidence-first way:

- identity checks for people, email addresses, phone numbers, and public profiles
- infrastructure checks for domains, IPs, hosts, and exposed services
- geographic context for places, reverse geocoding, and movement analysis
- public reference lookups to corroborate names, organisations, and entities
- reputation and risk checks for suspicious domains, URLs, and infrastructure

This means the tool works well for both structured, case-building research and exploratory OSINT investigations without forcing a single vendor or centralized backend.

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
  Example4.png
  Example5.png
```
