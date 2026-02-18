# Battleship — Project Plan

## 1. Tech Stack
### 1.1 Frontend Framework
- **React + TypeScript** with Vite as the build tool
- React Three Fiber (R3F) for 3D — it's the React binding for Three.js, keeps everything in the React component model
- Vite over CRA/Next: fastest dev server, simple config, no SSR complexity we don't need

### 1.2 3D Graphics
- **React Three Fiber** (R3F) — React bindings for Three.js
- **Drei** — utility library for R3F (OrbitControls, Text, Environment, Float, RoundedBox, Html)
- **@react-spring/three** — physics-based animations for ship placement, sinking, hit/miss effects

### 1.3 Backend & Real-time
- **Node.js + Express + TypeScript** — serves REST endpoints and static frontend
- **Socket.IO** — real-time multiplayer communication, room-based game lobbies, auto-reconnect
- Socket is a notification pipe only; database is the source of truth
- Disconnect handling: 60s grace period, opponent notified, game resumes on reconnect

### 1.4 Database / Persistence
- **PostgreSQL** via Railway's built-in Postgres addon — one dashboard, one bill
- Connection string via env var, zero external services to manage
- Stores: active game state (survives refresh/redeploy), completed game history (moves, outcome, timestamps)

### 1.5 Hosting
- **Railway** — deploy from GitHub, auto-deploys on push
- Single service: Express serves built React frontend as static files + handles API/WebSocket
- Postgres addon in the same Railway project

## 2. Architecture
### 2.1 Project Structure
- Flat monorepo with two separate folders, each with its own `package.json`
- `shared/` folder for TypeScript types used by both client and server (imported via relative paths)
```
battleship/
├── client/          # React + Vite + R3F
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── server/          # Express + Socket.IO
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── shared/          # Shared TypeScript types (GameState, Ship, Shot, SocketEvents, etc.)
│   └── types.ts
├── PLAN.md
└── README.md
```
- In production, server serves the built client from `client/dist/`

### 2.2 Client-Server Communication
- **Hybrid approach:** event-based for gameplay, full state sync for reconnection
- Gameplay events (specific, map to animations):
  - Client → Server: `create-game`, `join-game`, `place-ships`, `fire-shot`
  - Server → Client: `shot-result`, `ship-sunk`, `game-over`, `opponent-disconnected`, `turn-change`
- Reconnection event (full state dump):
  - Server → Client: `sync-state` — sent on reconnect, contains full game state
- Server is authoritative — client sends intentions, server validates and broadcasts results

### 2.3 Game State Management
- **Zustand** for client-side state — components subscribe to specific slices, avoids unnecessary R3F re-renders
- Built by the same team as R3F/Drei/react-spring (Poimandres)
- Socket event handlers update the Zustand store directly
- 3D components (Water, Lighting) never re-render from game state changes

## 3. Game Design
### 3.1 Ship Placement Phase
- **Click-to-place** — player hovers over the board, clicks to place the current ship
- **Rotate button** in the UI to toggle between horizontal and vertical orientation
- **Ghost preview** — semi-transparent ship follows the cursor via raycasting. Green if valid, red if overlapping or out of bounds.
- Ships placed in order: Carrier(5) → Battleship(4) → Cruiser(3) → Submarine(3) → Destroyer(2)
- "Confirm Fleet" button after all 5 ships are placed, with option to reset and re-place
- Server validates placement on confirm (bounds, overlap, correct sizes)

### 3.2 Firing Phase
- **Two boards side by side** — left: your fleet (shows incoming hits), right: opponent's grid (where you fire)
- **Hover to target** — cell highlights on hover, click to fire immediately
- **Feedback:** red marker for hit, white marker for miss, toast/banner + sinking animation when a ship is sunk
- Turn indicator clearly shows whose turn it is
- Cannot fire on already-targeted cells

### 3.3 AI (Single Player)
- Player selects difficulty before starting a single-player game
- **Easy — Random:** picks a random unchecked cell each turn
- **Medium — Hunt + Target:** random shots until a hit, then probes adjacent cells, follows direction until miss, reverses
- **Hard — Hunt + Target + Parity:** same as medium, but in hunt mode only targets checkerboard-pattern cells (halves search space)
- **Expert — Probability Density:** for each unchecked cell, calculates how many remaining ship placements overlap it, fires at highest-probability cell
- AI ships placed randomly with valid placement logic
- AI runs server-side (same validation as multiplayer, prevents client tampering)

### 3.4 Multiplayer Flow
- **Room code system** — Player 1 creates a game, gets a 4-character code (e.g. `ABCD`)
- Player 2 enters the code to join
- Flow: Menu → Create/Join → Placement Phase → Both ready → Firing Phase → Game Over → Rematch/Menu
- Disconnect: 60s grace period, opponent sees "Waiting for reconnect...", forfeit on timeout

## 4. 3D Graphics & Assets
### 4.1 Scene Setup & Camera
- **Fixed perspective camera** at ~70° angle looking down — readable tabletop feel
- No orbit controls, camera position is static
- Two boards visible side by side in the scene
- Ambient light + directional light for shadows/depth

### 4.2 Board Rendering
- **Water effect** — animated blue material (Drei's `MeshReflectorMaterial` or simple animated material) with grid lines drawn as `Line` geometries on top. Upgrade to custom shader if time permits.
- **Single plane + math** for hit detection — one mesh per board, compute cell from raycasted `e.point` world coordinates
- Scales to any board size (no per-cell meshes or event handlers)
- Cell highlight on hover via shader uniform (pass hovered cell coords to the shader)
- Coordinate labels (A-J, 1-10) rendered with Drei's `Text` component along the edges

### 4.3 Ships — 3D Models
- **Kenney Watercraft Pack** (CC0 license) — GLB format, loaded with Drei's `useGLTF`
- Model mapping (to be adjusted during development):
  - Carrier (5): `ship-large.glb`
  - Battleship (4): `ship-cargo-a.glb` or `ship-ocean-liner.glb`
  - Cruiser (3): `ship-ocean-liner-small.glb`
  - Submarine (3): `ship-small.glb`
  - Destroyer (2): `boat-speed-a.glb` or `boat-tug-a.glb`
- Scale and orientation adjusted per model to fit grid cell sizes

### 4.4 Visual Effects (Hit/Miss/Sunk)
- **Clean and minimal style**
- **Hit:** Red peg/pin sticking up from the cell
- **Miss:** White peg/pin
- **Sunk:** Ship tilts and sinks below the water (react-spring animation — translate Y down + slight rotation)
- Toast/banner announces which ship was sunk

## 5. Anti-Cheat & Security
### 5.1 Cheating Vectors
1. **Seeing opponent's ships** — inspecting network traffic / dev tools
2. **Invalid placements** — overlapping ships, out of bounds, wrong sizes
3. **Firing out of turn** — sending fire events when it's not your turn
4. **Firing same cell twice** — wasting opponent's time
5. **Spoofing identity** — joining as the other player after disconnect
6. **Client-side state manipulation** — modifying local game state via console

### 5.2 Server-Authoritative Design
- Server never sends opponent ship locations to the client — only hit/miss results and which ship was sunk
- All game logic runs server-side; client is a dumb view
- Client sends intentions (place ships, fire shot), server validates and broadcasts results

### 5.3 Input Validation
- Ship placement: server checks bounds, overlap, correct ship count and sizes
- Firing: server enforces turn order, rejects duplicate shots, rejects out-of-bounds coordinates
- Session identity: server generates a UUID player token on first connect, client stores in `localStorage`, sends via Socket.IO `auth` on every connection. Server matches token to player slot on reconnect.

## 6. Scaling Considerations
### 6.1 Runtime Complexity
- **Ship placement validation:** O(ship_length) per placement — check each cell for overlap in a 2D array (O(1) lookup per cell)
- **Shot processing:** O(1) — index into the grid array
- **Sunk detection:** O(1) — maintain a hit counter per ship, decrement on hit, sunk when counter reaches 0
- **Win detection:** O(1) — maintain a total unsunk ships counter, game over when it reaches 0
- **AI (Hunt+Target):** O(1) amortized per shot — maintain a set of available cells
- **AI (Probability Density):** O(board_size × num_remaining_ships × max_ship_length) per shot — recalculates probability map each turn. For 10x10 this is trivial, for very large boards could add a noticeable delay

### 6.2 Large Board Support
- **Board rendering:** Single plane + shader-based grid lines — scales infinitely, no per-cell geometry
- **Hit detection:** Single raycast + math to compute cell coordinates — O(1) regardless of board size
- **Storage:** Board stored as sparse data (only occupied/hit cells) rather than full NxN array for very large boards
- **AI:** Hunt+Target and Parity modes scale fine. Probability Density would need optimization (caching, incremental updates) for boards larger than ~100x100
- **Network:** Only changed cells are sent over the wire, not the full board

## 7. Deployment
### 7.1 Hosting Platform
- **Railway** — Hobby plan ($5/month, includes $5 usage credit)
- Auto-deploys from GitHub on push
- Postgres addon in the same project — no external services

### 7.2 Build & Serve Strategy
- Build step: `cd client && npm run build` → outputs static files to `client/dist/`
- Server serves `client/dist/` as static files via Express
- Single `PORT` env var (provided by Railway), SSL handled by platform
- One deployable service: the Express server handles everything (static files + API + WebSocket)

### 7.3 Database Persistence in Production
- Railway Postgres persists across redeploys — it's a separate service, not tied to the app container
- `DATABASE_URL` env var auto-injected by Railway
- Schema migrations run on server startup (simple `CREATE TABLE IF NOT EXISTS`)
