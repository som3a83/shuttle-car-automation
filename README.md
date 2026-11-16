# Shuttle Car Automation V6

This repository now contains a working V6 web application foundation for the Shuttle Car Automation platform. The code is implemented as a Vite + React + TypeScript project and includes industrial fleet monitoring, maintenance, fault management, battery oversight, engineering visualizations, AI diagnostics guidance, and multi-language support.

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app in development mode:
   ```bash
   npm run dev
   ```
3. Open the local Vite URL in a browser.
4. Run tests with:
   ```bash
   npm test
   ```
5. Create a production bundle:
   ```bash
   npm run build
   ```

## Included modules

- Dashboard with fleet KPIs
- Fleet control center with searchable shuttle records
- Engineering visualization center with representative SVG views
- Battery management center
- Fault and diagnostics records
- Maintenance work orders
- AI assistant with technical verification wording
- Device connection adapter architecture
- Reports export
- Notifications center
- User access and settings
- English and Arabic toggling with RTL/LTR behavior
- Dark mode and light mode

## Important note

This project is an implementation of a V6 industrial monitoring platform based on the repository state available in the GitHub session. It does not claim to be a verified manufacturer CAD model or to have real PLC hardware connectivity without explicit vendor documentation and credentials outside this repository.

## Security guidance

- Do not commit actual device credentials, API keys, or production secrets.
- Use read-only telemetry integration first.
- Keep any manufacturer-level API credentials server-side and out of the repository.
