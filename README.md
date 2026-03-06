# Pitch Stat Pro Web

A browser-based pitching statistics tracker for baseball and softball. Record every pitch with type, zone, and result, then analyze detailed breakdowns to identify strengths and weaknesses.

Companion web app to **Pitch Stat Pro** for iOS — data files are compatible between both platforms.

**Live site:** [https://chrisfore.github.io/PitchStatProWeb/](https://chrisfore.github.io/PitchStatProWeb/)

## Features

- **Pitch-by-Pitch Tracking** — Record each pitch with player, pitch type, zone(s), and result (Strike, Ball, Foul, Hit)
- **Sport-Specific Defaults** — Choose Baseball or Softball during setup to get appropriate pitch types and zones
- **Multi-Zone Selection** — Select up to 2 zones per pitch (e.g., Inside / Low)
- **Live Results** — Real-time pitch breakdowns displayed alongside tracking controls
- **Win% Color Coding** — Green (65%+), yellow (48–64%), red (below 48%) for quick analysis
- **Results & Statistics** — Detailed stats including strike%, ball%, foul%, hit%, and win% per pitch/zone combo
- **PDF Export** — Generate printable reports filtered by player or date range
- **Data Import/Export** — Export individual players or all data as `.pitchdata` files compatible with the iOS app
- **Team Logo** — Upload a logo to display on exported PDF reports
- **Customizable** — Add, rename, or remove players, pitch types, and zones; changes update all existing records
- **Dark Mode** — Toggle between light and dark themes
- **Undo Support** — Remove the most recent pitch entry with confirmation

## How to Use

### Getting Started
1. Open the app and select your sport (Baseball or Softball)
2. Default pitch types and zones are created based on your sport
3. Add your players in the **Settings** tab

### Tracking Pitches
1. Select a player from the Track tab
2. Choose a pitch type, one or two zones, and the result
3. Tap **Submit Pitch** to record
4. Pitch type, zones, and result reset automatically for the next pitch
5. Live Results on the right update in real time

### Viewing Results
1. Go to the **Results** tab for detailed statistics
2. Filter by player or enable date range filtering
3. Stats show strike%, ball%, foul%, hit%, and win% for each pitch/zone combination
4. Use **Export PDF** to generate a printable report

### Managing Data
- **Export Player** — Save a single player's data as a `.pitchdata` file
- **Export All Data** — Back up everything
- **Import Data** — Load `.pitchdata` or `.json` files from the iOS app or another browser

## Data Storage

All data is stored locally in your browser using localStorage. It persists across restarts but:
- Clearing browser/site data will erase your data
- Private/Incognito mode does not persist data
- Different browsers maintain separate data

**Export your data regularly as a backup.**

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- localStorage for data persistence
- sql.js (SQLite compiled to WebAssembly) for data querying
- No build tools required
