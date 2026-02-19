# Battleship

**Live:** [https://battleship-production-1cdf.up.railway.app/](https://battleship-production-1cdf.up.railway.app/)

A full-stack 3D Battleship game with single-player AI (4 difficulty levels) and real-time multiplayer. Built with React Three Fiber, Node.js, Socket.IO, and PostgreSQL.

## Approach

### Architecture

The project is a flat monorepo with three directories:

- **`client/`** — React + TypeScript + Vite frontend with React Three Fiber for 3D rendering
- **`server/`** — Express + Socket.IO backend with game logic and PostgreSQL persistence
- **`shared/`** — TypeScript types shared between client and server

In production, the Express server serves the built client as static files and handles API/WebSocket connections — a single deployable service.

### Server-Authoritative Design

All game logic runs server-side. The client is a rendering layer that sends intentions (place ships, fire shot) and receives validated results. The server never sends opponent ship positions to the client — only hit/miss results and which ship was sunk. This prevents the most common cheating vectors:

- **Seeing opponent ships:** Ship locations never leave the server until revealed by hits
- **Invalid placements:** Server validates bounds, overlap, ship counts and sizes
- **Firing out of turn:** Server enforces turn order and rejects duplicate shots
- **Identity spoofing:** Players get a UUID token stored in localStorage, matched on reconnect

### Client-Server Communication

A hybrid approach: event-based messages for gameplay (maps cleanly to animations), full state sync for reconnection.

- **Gameplay events:** `create-game`, `join-game`, `place-ships`, `fire-shot` from client; `shot-result`, `opponent-shot`, `turn-change`, `game-over` from server
- **Reconnection:** Client stores `gameId` + `playerId` in localStorage. On page load, it attempts `reconnect-game` and the server responds with the full client-safe game state, rebuilt from the in-memory game or the database

### State Management

Zustand manages client-side state. Socket event handlers update the store directly, and React components subscribe to specific slices. This keeps 3D components like Water and Lighting from re-rendering when game state changes.

### AI Difficulty Levels

All AI modes share the same core pattern — **hunt mode** (searching) and **target mode** (finishing a hit ship by probing adjacent cells). They differ in hunt strategy:

| Difficulty | Hunt Strategy | Avg Shots |
|---|---|---|
| Easy | Pure random | ~95 |
| Medium | Random + target mode on hit | ~65 |
| Hard | Checkerboard parity + target mode | ~55 |
| Expert | Probability density map + target mode | ~45 |

The expert AI calculates, for every unfired cell, how many valid placements of remaining ships could overlap that cell — then fires at the highest-density cell.

### 3D Rendering

- **React Three Fiber** with Drei utilities for the scene graph
- **Kenney Watercraft Pack** (CC0 license) for ship models, loaded as GLB with `useGLTF`
- **Three.js Water shader** for the animated ocean surface
- **react-spring** for physics-based sinking animations (translate Y + rotation)
- Hit markers use `buoy-flag.glb` (dark, for hits) and `buoy.glb` (colored, for misses)
- Ship placement uses a ghost preview — green if valid, red if overlapping/out of bounds

### Persistence

PostgreSQL stores:

- **`games`** — game metadata, full JSONB state snapshot (for reconnection across server restarts), winner, timestamps
- **`game_moves`** — every shot with player, coordinates, result, sunk ship, timestamp
- **`game_players`** — player-to-game mapping with ship placements

Game state survives page refresh via the reconnection flow: localStorage session + DB-backed state restoration.

### Scaling Considerations

- **Board rendering:** Single plane geometry + math-based hit detection. No per-cell meshes — scales to any board size
- **Shot processing:** O(1) grid lookup. Sunk detection via hit counter per ship. Win detection via unsunk ship counter
- **AI complexity:** Hunt+Target is O(1) amortized. Probability density is O(board_size x remaining_ships x max_ship_length) per shot — trivial for 10x10, would need optimization above ~100x100
- **Network:** Only events for changed cells, not full board state (except on reconnect)

### How I Used AI

I used Claude Code throughout the build. The workflow was:

1. **Planning:** Wrote `PLAN.md` covering architecture, game design, AI algorithms, anti-cheat, and scaling — then used it as a reference document throughout
2. **Scaffolding:** Generated the initial project structure, Express server, Socket.IO event handlers, and React component skeletons
3. **Game logic:** Implemented and iterated on placement validation, firing logic, AI algorithms, and the reconnection flow
4. **3D rendering:** Built the R3F scene, ship model loading/scaling, water shader, coordinate labels, and shot markers
5. **Debugging:** Used Claude Code to diagnose build errors, path issues, and deployment problems (e.g., the client dist path resolution for Railway)

The key was giving Claude Code strong context through the plan document and iterating in small, testable increments rather than trying to generate everything at once.

## Running Locally

### Prerequisites

- Node.js 18+
- PostgreSQL (optional — runs without persistence if `DATABASE_URL` is not set)

### Setup

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Set up environment (optional, for persistence)
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL

# Start the server (port 3001)
cd server && npm run dev

# In another terminal, start the client (port 5173)
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# From the repo root:
npm run build   # builds client + server
npm start       # serves everything on PORT (default 3001)
```

## Deployment

Deployed on Railway with:

- A single service running the Express server (serves static client + API + WebSocket)
- Railway Postgres addon for persistence
- Auto-deploys from GitHub on push
- `DATABASE_URL` injected via Railway environment variables

## Project Structure

```
battleship/
├── client/                  # React + Vite + R3F
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board3D.tsx        # Placement board (grid, ghost preview, coordinate labels)
│   │   │   ├── FiringBoard.tsx    # Attack + Defense boards (shot markers, hover, ships)
│   │   │   ├── GameScene.tsx      # R3F Canvas, lighting, water shader
│   │   │   ├── PlacementUI.tsx    # Ship list, rotate/reset/confirm buttons
│   │   │   └── Ship3D.tsx         # 3D ship model loader with sinking animation
│   │   ├── store/
│   │   │   └── gameStore.ts       # Zustand store + socket event handlers
│   │   ├── socket.ts             # Socket.IO client
│   │   └── App.tsx               # Menu, lobby, game screens
│   └── public/models/            # GLB ship models + colormap texture
├── server/
│   └── src/
│       ├── index.ts              # Express + Socket.IO server, event routing
│       ├── game.ts               # Game logic, validation, AI algorithms
│       └── db.ts                 # PostgreSQL schema, queries
├── shared/
│   └── types.ts                  # Shared TypeScript types
└── PLAN.md                       # Detailed project plan
```
