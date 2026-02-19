# Battleship

**Live:** [https://battleship-production-1cdf.up.railway.app/](https://battleship-production-1cdf.up.railway.app/)

A full-stack 3D Battleship game with single-player AI (4 difficulty levels) and real-time multiplayer. Built with React Three Fiber, Node.js, Socket.IO, and PostgreSQL.

## Approach

### How I Used AI

I used Claude Code with Claude Opus 4.6 to build. The way I approached this was to generate an [extensive planning document](./PLAN.md) first, where I make all the high level decisions and make sure the spec is really clear. This was the most important part. 

For the planning session, I presented Claude Code the [requirements](./requirements.md) for the project and the specific 3D angle I wanted to take. I already knew that 3JS would be a good fit for this kind of a project, but with Claude's suggestion I explored React Three Fiber (R3F), which is built on top of 3JS. Because of the time limitation, my main consideration here was that it had to be mainstream enough for Claude Code to generate code with as little bugs as possible.

I quickly searched online if I could find pre-made 3D assets that I can use for this project and whether R3F (or additional libraries related to it) had built in support for common 3D operations such as camera controls and ray tracing. Once I was convinced that all of these things had standard implementations with R3F, I was confident that I can rely on Claude Code to generate the logic with minimal issues.

Once the 3D aspect was decided, I asked Claude to ask me each decision one by one, the deployment platform, the database structure, the game design, etc. For each decision, I had a discussion with Claude to understand various tradeoffs. I usually opted for simpler & more generic options so that a) AI would have an easier time implementing and b) it would be easier for me to keep a mental model of the system.

Once the planning document was created, I asked Claude to implement the plan. Here the most important part was to make sure it implements iteratively, where I can check its progress and guide it along the way. I first created a basic menu, and deployed the app on Railway. Then one by one, I created the game board, ability to add ships, ability to play a basic game, the database connection and storing the game state, making sure the game state is preserved when one player disconnects, adding the 3D ship models, and polishing various aspects.

If you look at my commit history, you can see the steps in which the game came alive. In each step, I had a more or less working version, so that if Claude goes in and makes a bunch of changes that messes up existing working code, I can easily revert back. This way it was easier to debug as well, and I could isolate each issue to a specific commit, this made it easier for Claude to debug as well, if something started going wrong, you knew that it had to be some code change between the last working commit and the current one.

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

### Anti-Cheat

The server is the single source of truth. The client is a rendering layer — all mutations go through server validation. Here's every attack vector and how it's handled:

| Attack | How it's prevented |
|---|---|
| **Inspect network traffic to see opponent's ships** | Server never sends opponent ship locations. Only hit/miss results and which ship was sunk are transmitted. |
| **Fire out of turn** | `fireShot()` checks `game.currentTurn !== shooterId` and rejects. |
| **Fire on the same cell twice** | Server checks `shooter.shots[row][col]` — already-fired cells are rejected. |
| **Fire out of bounds** | Server validates `row` and `col` are within `[0, BOARD_SIZE)`. |
| **Place ships that overlap or go out of bounds** | `validatePlacement()` checks bounds, overlap, correct ship names, sizes, and count (exactly 5 ships). |
| **Place ships after already confirming** | Server checks `player.ready` — once ships are confirmed, placement is locked. |
| **Spoof another player's identity (stolen playerId)** | Socket handlers check `socketToPlayer.get(socket.id) !== data.playerId` — the socket must be the one that originally registered the playerId via create/join/reconnect. |
| **Modify local state via browser console** | Client state (Zustand store) is cosmetic. Changing `isMyTurn` locally unlocks the fire button, but the server still rejects the shot. A reconnect restores the true state. |
| **Remove or undo opponent's shot markers** | No socket event exists for this. The server only accepts forward actions (place, fire). Mutating local state has no server-side effect. |
| **Send malformed payloads (wrong types, missing fields)** | Game logic functions return error strings for invalid inputs; the server responds with `{ success: false }` and does not mutate state. |

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
