# 3D Mobile-Oriented Solitaire (Three.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully featured, mobile-oriented 3D Klondike Solitaire game using Three.js with realistic card meshes, fluid touch drag-and-drop / single-tap auto-move, synthesized audio effects, responsive mobile camera, undo history, hint solver, and Docker deployment on port 9876.

**Architecture:** A pure headless TypeScript Solitaire core handles all game rules, state transitions, undoable commands, and hint solving independently of the rendering layer. Three.js renders a 3D casino felt table with beveled rounded-corner card meshes and procedural high-DPI vector textures. A unified pointer raycaster manages touch/mouse interactions with responsive mobile frustum scaling, and modern HTML/CSS overlays provide the thumb-friendly mobile HUD.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Web Audio API, Docker, Nginx Alpine.

**Spec:** `docs/superpowers/specs/2026-09-23-threejs-mobile-solitaire-design.md`

## Global Constraints

- Must run smoothly on mobile viewports (portrait-first with responsive landscape support) with touch drag-and-drop and single-tap smart move.
- Must render "real cards" in 3D: rounded corners, physical card thickness, high-res procedural vector canvas textures for front/back/edges, dynamic lighting, and soft shadows.
- Zero external image or audio asset dependencies: all card graphics generated procedurally via HTML5 Canvas/SVG, all sound effects synthesized via Web Audio API.
- Multi-stage Docker container serving the application on port `9876` with healthcheck and Docker Compose.
- 100% unit test coverage for core game mechanics (deck, game state, moves, undo/redo, hints).

## Review Focus

1. **Rapid multi-card touch dragging on mobile**: Ensure raycaster picks up all child cards in a tableau cascade and tracks finger position without jitter or offset drifting.
2. **Tableau card auto-flipping**: Ensure exposed face-down top card flips face-up automatically when upper cards are moved away, and correctly reverts on undo.
3. **Multi-level Undo integrity**: Ensure reversing a move accurately restores previous card face-up states, pile counts, score, and move counter.
4. **Auto-complete & Win detection**: Trigger victory cascade only when all 52 cards are on foundations, and offer auto-complete prompt when all cards are face-up with empty stock.
5. **Mobile screen aspect ratio adaptation**: Ensure camera dynamically repositions in portrait view (e.g. 9:16 to 9:20) so all 7 tableau columns and top slots are visible without horizontal scrolling or clipping.

---

### Task 1: Project Scaffolding & Tooling Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx.conf`
- Create: `public/favicon.svg`

**Interfaces:**
- Produces: Project build pipeline (`npm run build`, `npm run dev`, `npm run test:run`) and Docker container configuration for port `9876`.

- [ ] **Step 1: Create package.json with Three.js, Vite, and Vitest dependencies**

```json
{
  "name": "threejs-mobile-solitaire",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview --port 9876",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "three": "^0.162.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/three": "^0.162.0",
    "typescript": "^5.3.3",
    "vite": "^5.1.4",
    "vitest": "^1.3.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json and vite.config.ts**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "moduleResolution": "Node",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 9876
  },
  preview: {
    host: '0.0.0.0',
    port: 9876
  }
});
```

- [ ] **Step 3: Create index.html, public/favicon.svg, nginx.conf, Dockerfile and docker-compose.yml**

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#0d3b1e" />
    <title>3D Solitaire</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/src/ui/styles.css" />
  </head>
  <body>
    <div id="app">
      <div id="canvas-container"></div>
      <div id="hud-container"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`public/favicon.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#1b5e20"/>
  <rect x="12" y="8" width="40" height="48" rx="6" fill="#ffffff" stroke="#e0e0e0" stroke-width="2"/>
  <text x="32" y="40" font-size="30" text-anchor="middle" fill="#d32f2f" font-family="serif">♠</text>
</svg>
```

`nginx.conf`:
```nginx
server {
    listen 9876;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

`Dockerfile`:
```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 9876
CMD ["nginx", "-g", "daemon off;"]
```

`docker-compose.yml`:
```yaml
version: '3.8'
services:
  solitaire:
    build: .
    container_name: solitaire-3d
    ports:
      - "9876:9876"
    restart: unless-stopped
```

- [ ] **Step 4: Install dependencies and run tests**

Run: `npm install`
Expected: Success with `node_modules` generated.

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json tsconfig.json vite.config.ts index.html public/ nginx.conf Dockerfile docker-compose.yml
git commit -m "chore: scaffold project with vite, three.js, typescript and docker configuration"
```

---

### Task 2: Core Data Types & Deck Engine

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/Card.ts`
- Create: `src/core/Deck.ts`
- Test: `tests/deck.test.ts`

**Interfaces:**
- Produces:
  - `Suit`: `'hearts' | 'diamonds' | 'clubs' | 'spades'`
  - `Rank`: `1..13` (1 = Ace, 11 = Jack, 12 = Queen, 13 = King)
  - `Card`: `{ id: string, suit: Suit, rank: Rank, isFaceUp: boolean }`
  - `Deck`: `createDeck(): Card[]`, `shuffle(cards: Card[]): Card[]`
  - Helpers: `getCardColor(suit: Suit)`, `getRankName(rank: Rank)`

- [ ] **Step 1: Write failing deck test**

`tests/deck.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, getCardColor } from '../src/core/Deck';

describe('Deck and Card utilities', () => {
  it('creates standard 52-card deck with 4 suits and 13 ranks', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    expect(suits.has('hearts')).toBe(true);
    expect(suits.has('diamonds')).toBe(true);
    expect(suits.has('clubs')).toBe(true);
    expect(suits.has('spades')).toBe(true);

    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
    for (let r = 1; r <= 13; r++) {
      expect(ranks.has(r as any)).toBe(true);
    }
  });

  it('correctly identifies red and black card colors', () => {
    expect(getCardColor('hearts')).toBe('red');
    expect(getCardColor('diamonds')).toBe('red');
    expect(getCardColor('clubs')).toBe('black');
    expect(getCardColor('spades')).toBe('black');
  });

  it('shuffles deck using Fisher-Yates without mutating card count', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck([...deck]);
    expect(shuffled.length).toBe(52);
    // Verify all unique cards still present
    const ids = new Set(shuffled.map(c => c.id));
    expect(ids.size).toBe(52);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement types, Card, and Deck modules**

`src/core/types.ts`:
```ts
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardColor = 'red' | 'black';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface PileLocation {
  type: PileType;
  index: number; // 0 for stock/waste, 0..3 for foundations, 0..6 for tableau
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

export interface GameStats {
  score: number;
  moves: number;
  timeElapsed: number; // in seconds
  drawMode: 1 | 3;
}
```

`src/core/Card.ts`:
```ts
import { Card, CardColor, Rank, Suit } from './types';

export function getCardColor(suit: Suit): CardColor {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

export function getRankSymbol(rank: Rank): string {
  switch (rank) {
    case 1: return 'A';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    default: return rank.toString();
  }
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

export function getCardLabel(card: Card): string {
  return `${getRankSymbol(card.rank)}${getSuitSymbol(card.suit)}`;
}
```

`src/core/Deck.ts`:
export `createDeck`, `shuffleDeck`, `getCardColor` functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ types.ts Card.ts Deck.ts tests/deck.test.ts
git commit -m "feat: implement core card models, deck generator, and shuffle"
```

---

### Task 3: Klondike Game State Machine & Move Validator

**Files:**
- Create: `src/core/GameState.ts`
- Test: `tests/gamestate.test.ts`

**Interfaces:**
- Produces: `GameState` class
  - `initGame(drawMode?: 1 | 3)`: Deals 7 tableau columns (1..7 cards, top face-up), 24 stock cards, 4 empty foundations, 0 waste.
  - `canMoveCards(cards: Card[], target: PileLocation): boolean`
  - `moveCards(source: PileLocation, target: PileLocation, count: number): boolean`
  - `drawStock(): boolean`
  - `recycleWaste(): boolean`
  - `isGameWon(): boolean`
  - `canAutoComplete(): boolean`
  - `autoCompleteStep(): boolean`

- [ ] **Step 1: Write failing tests for GameState**

`tests/gamestate.test.ts`:
- Test game deal: 28 cards in tableau (7 top cards face-up), 24 in stock, 0 in waste, 0 in foundations.
- Test tableau placement rules: Red 7 on Black 8 (valid), Red 7 on Red 8 (invalid), King (13) on empty tableau (valid), Non-king on empty tableau (invalid).
- Test foundation placement rules: Ace on empty foundation (valid), 2 on Ace same suit (valid), 2 on Ace different suit (invalid).
- Test auto-flipping exposed face-down tableau card when child cards move away.
- Test win condition when all 4 foundations reach 13 cards.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL.

- [ ] **Step 3: Implement GameState**

Write `src/core/GameState.ts` with all Klondike rule logic, deal initialization, move validation, auto-flip logic, auto-complete detection, and event hooks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/GameState.ts tests/gamestate.test.ts
git commit -m "feat: implement Klondike game state machine and move validation"
```

---

### Task 4: Undo/Redo Command Stack & Hint Solver Engine

**Files:**
- Create: `src/core/Commands.ts`
- Create: `src/core/HintEngine.ts`
- Create: `src/core/Scoring.ts`
- Test: `tests/commands.test.ts`
- Test: `tests/hintengine.test.ts`

**Interfaces:**
- Produces:
  - `CommandHistory`: `execute(cmd)`, `undo(): boolean`, `redo(): boolean`, `canUndo()`, `canRedo()`
  - `HintEngine`: `findBestMove(state: GameState): HintMove | null`
  - `ScoreManager`: `addScore(points)`, `recordMove()`, `getScore()`, `getMoves()`

- [ ] **Step 1: Write failing tests for Commands and HintEngine**

`tests/commands.test.ts`:
- Test moving cards from tableau to foundation and executing undo reverts card position, restore face-up states, and reverses score.
- Test draw stock and undo recovers stock state.
- Test recycle waste and undo recovers waste state.

`tests/hintengine.test.ts`:
- Test finding foundation moves first.
- Test finding moves that uncover face-down cards.
- Test suggesting stock draw when no tableau/foundation moves exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL.

- [ ] **Step 3: Implement Commands, HintEngine, and Scoring**

Implement command classes (`MoveCardsCommand`, `DrawStockCommand`, `RecycleWasteCommand`), `HintEngine`, and `ScoreManager`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/Commands.ts src/core/HintEngine.ts src/core/Scoring.ts tests/commands.test.ts tests/hintengine.test.ts
git commit -m "feat: implement undo/redo command stack, score tracking, and hint engine"
```

---

### Task 5: Procedural SVG Card Texture & 3D Beveled Mesh Generator

**Files:**
- Create: `src/gfx/CardMeshFactory.ts`
- Create: `src/gfx/Card3D.ts`
- Test: `tests/cardfactory.test.ts`

**Interfaces:**
- Produces:
  - `CardMeshFactory`:
    - `generateCardFrontTexture(card: Card): THREE.CanvasTexture`
    - `generateCardBackTexture(): THREE.CanvasTexture`
    - `createCardMesh(card: Card): Card3D`
  - `Card3D`: Three.js `Group` or `Mesh` encapsulating 3D geometry with front, back, and edge materials, card metadata, position interpolation, flip state, and shadow properties.

- [ ] **Step 1: Write test for CardMeshFactory texture creation**

`tests/cardfactory.test.ts`:
- Test procedural canvas generator produces valid 2D canvas contexts with front face pips, suit illustrations, and back patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL.

- [ ] **Step 3: Implement CardMeshFactory and Card3D**

- Render razor-sharp vector front faces: top-left & bottom-right indices + suit pips + center suit patterns for numbers 1-10 + detailed court card illustrations for J, Q, K.
- Render ornate card back: royal blue/red symmetric lattice with double border.
- Create 3D geometry: `ExtrudeGeometry` with rounded corner `Shape` or beveled box with thickness `0.008`.
- Configure `MeshStandardMaterial` for realistic paper sheen and `castShadow = true` / `receiveShadow = true`.

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gfx/CardMeshFactory.ts src/gfx/Card3D.ts tests/cardfactory.test.ts
git commit -m "feat: implement procedural 3D card mesh factory and high-res vector canvas textures"
```

---

### Task 6: 3D Scene, Felt Tabletop, Lighting & Animation Tween Engine

**Files:**
- Create: `src/gfx/SceneManager.ts`
- Create: `src/gfx/Tabletop.ts`
- Create: `src/gfx/AnimationManager.ts`

**Interfaces:**
- Produces:
  - `SceneManager`: `init(container: HTMLElement)`, `render()`, `resize()`, `getScene()`, `getCamera()`, `getRenderer()`
  - `Tabletop`: Creates felt mesh, slot markers for 4 Foundations, 1 Stock, 1 Waste, 7 Tableau columns.
  - `AnimationManager`:
    - `animateMove(card3D: Card3D, targetPos: Vector3, duration?: number): Promise<void>`
    - `animateFlip(card3D: Card3D, targetFaceUp: boolean, duration?: number): Promise<void>`
    - `animateDeal(cards: Card3D[]): Promise<void>`
    - `animateWinCascade(cards: Card3D[]): void`

- [ ] **Step 1: Implement Tabletop and SceneManager**

- Set up WebGL renderer with anti-aliasing, shadow map enabled (`PCFSoftShadowMap`), tone mapping.
- Camera: Perspective camera with automatic vertical FOV recalculation based on viewport aspect ratio (portrait vs landscape).
- Tabletop: Deep emerald green felt surface with subtle slot borders for card layout.
- Lights: Ambient light for balanced illumination + Directional shadow-casting spotlight.

- [ ] **Step 2: Implement AnimationManager**

- Smooth tween system with quadratic Bezier arcing for card lifts and flips.
- Deal sequence: Deals cards one by one from stock to 7 tableau columns with audio sync.
- Cascade win celebration: Dynamic physics-based card bounce cascading across the screen.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/gfx/SceneManager.ts src/gfx/Tabletop.ts src/gfx/AnimationManager.ts
git commit -m "feat: implement 3D scene, felt tabletop, lighting, and animation tween manager"
```

---

### Task 7: Mobile Touch & Pointer Interaction with Raycasting Drag-and-Drop

**Files:**
- Create: `src/input/InteractionManager.ts`
- Create: `src/input/DragPlane.ts`

**Interfaces:**
- Produces:
  - `InteractionManager`:
    - Listens to `pointerdown`, `pointermove`, `pointerup`, `pointercancel`.
    - Handles single-tap smart move (finds lowest valid foundation or tableau destination and auto-glides card).
    - Handles multi-card column dragging (lifts stack, follows finger on 3D drag plane with tilt, detects valid drop targets, returns stack if invalid).
    - Stock tapping (deal / recycle).

- [ ] **Step 1: Implement DragPlane helper**

`src/input/DragPlane.ts`:
Calculates intersection point between raycaster and horizontal 3D plane at lifted card height `Z`.

- [ ] **Step 2: Implement InteractionManager**

- Unified pointer events with touch identifier tracking and drag distance threshold (> 6px).
- Highlight valid drop target column or foundation slot when card is hovering nearby.
- Tap detection (< 250ms and < 6px movement) triggers smart auto-move.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/input/InteractionManager.ts src/input/DragPlane.ts
git commit -m "feat: implement mobile touch interaction manager, raycaster, and drag-and-drop controller"
```

---

### Task 8: Web Audio Procedural Sound Effects & Mobile HUD Overlay

**Files:**
- Create: `src/audio/SoundEffects.ts`
- Create: `src/ui/HUD.ts`
- Create: `src/ui/WinCelebration.ts`
- Create: `src/ui/styles.css`
- Create: `src/main.ts`

**Interfaces:**
- Produces:
  - `SoundEffects`: `playDeal()`, `playSnap()`, `playFlip()`, `playUndo()`, `playWinFanfare()`, `toggleMute()`, `isMuted()`
  - `HUD`: Top status bar (Score, Timer, Moves, Draw Mode, Mute), Bottom action bar (Undo, Hint, Restart, New Game).
  - `WinCelebration`: Shows victory banner, statistics modal, and Play Again button.
  - `main.ts`: Glues GameState, Three.js Scene, InteractionManager, Audio, and HUD together.

- [ ] **Step 1: Implement SoundEffects using Web Audio API**

Synthesize all card audio procedurally (no MP3/WAV files needed):
- `playDeal`: Fast noise swoosh.
- `playSnap`: Felt card tap click.
- `playFlip`: Crisp flick tone.
- `playUndo`: Soft reverse tone.
- `playWinFanfare`: Pentatonic arpeggio chords.

- [ ] **Step 2: Implement HUD, WinCelebration, styles.css, and main.ts**

- Create responsive mobile layout with large touch targets for thumbs.
- Style top header HUD and bottom floating control dock.
- Wire full game loop, event listeners, timer ticks, and auto-complete prompt.

- [ ] **Step 3: Run full test suite and verify build**

Run: `npm run test:run && npm run build`
Expected: All tests pass, build passes cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/audio/SoundEffects.ts src/ui/HUD.ts src/ui/WinCelebration.ts src/ui/styles.css src/main.ts
git commit -m "feat: implement Web Audio sound effects, mobile HUD overlay, and main game loop"
```

---

### Task 9: Docker Containerization, Port 9876 & Full Verification

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `nginx.conf`

**Interfaces:**
- Produces: Working Docker container exposed and accessible on port `9876`.

- [ ] **Step 1: Build Docker container**

Run: `docker build -t solitaire-3d .`
Expected: Docker image successfully built.

- [ ] **Step 2: Run container on port 9876**

Run: `docker run -d --name solitaire-3d -p 9876:9876 solitaire-3d`
Expected: Container started and running.

- [ ] **Step 3: Verify HTTP endpoint on port 9876**

Run: `curl -I http://localhost:9876/`
Expected: HTTP 200 OK with Nginx server headers and HTML response.

- [ ] **Step 4: Commit and finalize**

```bash
git add Dockerfile docker-compose.yml nginx.conf
git commit -m "chore: verify Docker container configuration on port 9876"
```
