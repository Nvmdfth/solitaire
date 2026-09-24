# 3D Mobile-Oriented Solitaire (Three.js) Specification

**Date:** 2026-09-23  
**Status:** Approved  
**Author:** Antigravity  

---

## 1. Executive Summary

This document specifies the architecture, graphics pipeline, user interaction model, sound synthesis, and containerization strategy for a realistic 3D Klondike Solitaire game built using Three.js, TypeScript, and Vite. The application is tailored specifically for mobile touchscreens (with full desktop/tablet responsiveness) and is self-contained with no external media dependencies. It is packaged in a lightweight multi-stage Docker container served on port `9876`.

---

## 2. Goals & Success Criteria

- **Realistic "Real Cards" Visuals**: 3D card meshes with realistic physical dimensions (depth/thickness, rounded corners, beveled edges), ultra-high-resolution procedural vector front faces (crisp court cards and suit pips), classic card backs, felt casino tabletop with slot markings, dynamic lighting, and soft shadows.
- **Fluid 3D Animations**: Dealing animation arcs, Y-axis card flips with Z-elevation, smooth glide moves, stack drag tilts, and an explosive victory cascade upon winning.
- **Mobile-First UX**: Responsive camera frustum adapting seamlessly to mobile portrait aspect ratios, single-tap auto move (smart assist), fluid multi-card drag-and-drop raycasting, and bottom-anchored thumb-accessible HUD controls (Undo, Hint, Restart, New Game).
- **Pure Rule Engine & Undo Stack**: Headless TypeScript Solitaire core supporting standard Klondike rules (Draw-1 and Draw-3 modes), full multi-level undo/redo, auto-complete detection, scoring, timer, and intelligent hint generation.
- **Zero External Media Dependencies**: Procedural canvas/SVG textures for cards and procedural Web Audio API synthesis for sounds (card swoosh, snap, flip, victory fanfare).
- **Production Docker Container**: Production build served via Nginx on port `9876` with healthcheck and Docker Compose setup.

---

## 3. Architecture & Module Structure

```
solitaire/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts                   # Bootstrapper, game loop & HUD event wiring
│   ├── core/                     # Pure TypeScript Headless Solitaire Engine
│   │   ├── types.ts              # Card, Suit, Rank, Pile types & Move interfaces
│   │   ├── Card.ts               # Card model & validation helpers
│   │   ├── Deck.ts               # Deck generator, Fisher-Yates shuffle
│   │   ├── GameState.ts          # Klondike state machine & move validator
│   │   ├── Commands.ts           # Undoable Command pattern (Move, Draw, Flip)
│   │   ├── HintEngine.ts         # Move suggestion solver
│   │   └── Scoring.ts            # Score, move count, and timer manager
│   ├── gfx/                      # Three.js 3D Graphics Engine
│   │   ├── SceneManager.ts       # Scene, camera, lighting, shadows, resize handler
│   │   ├── CardMeshFactory.ts    # 3D Card mesh generator, bevel geometry & SVG textures
│   │   ├── Tabletop.ts           # Felt table mesh, borders, and pile slot markers
│   │   ├── AnimationManager.ts   # Tween controller (deals, flips, slides, win cascade)
│   │   └── Card3D.ts             # 3D card mesh wrapper & state synchronization
│   ├── input/                    # Touch & Pointer Interaction
│   │   ├── InteractionManager.ts # Raycasting, tap detection, drag-and-drop controller
│   │   └── DragPlane.ts          # 3D drag plane calculations for touch follow
│   ├── audio/                    # Procedural Sound Synthesizer
│   │   └── SoundEffects.ts       # Web Audio API sound FX (snap, flip, slide, win)
│   └── ui/                       # Mobile-First Overlay HUD
│       ├── HUD.ts                # Score, timer, moves, draw toggle, bottom controls
│       ├── WinCelebration.ts     # Victory banner & end-game statistics modal
│       └── styles.css            # Responsive mobile CSS overlay
└── tests/                        # Vitest Unit Tests
    ├── deck.test.ts
    ├── gamestate.test.ts
    ├── commands.test.ts
    └── hintengine.test.ts
```

---

## 4. Detailed Component Design

### 4.1. Core Solitaire Engine (`src/core/`)

- **`types.ts`**:
  - `Suit`: `'hearts' | 'diamonds' | 'clubs' | 'spades'`
  - `Rank`: `1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13`
  - `PileType`: `'stock' | 'waste' | 'foundation' | 'tableau'`
  - `PileLocation`: `{ type: PileType, index?: number }`
  - `Card`: `{ id: string, suit: Suit, rank: Rank, isFaceUp: boolean }`
  - `MoveCommand`: Encapsulates source pile, destination pile, card count, previous face-up states, score delta, and timestamp.
- **`GameState.ts`**:
  - Initializes 7 tableau columns (1 to 7 cards, top card face-up), 4 empty foundation piles, empty waste, and 24-card stock pile.
  - Supports `drawMode: 1 | 3`.
  - Move validation:
    - Tableau: Stacking requires alternating color (`hearts/diamonds` on `clubs/spades` or vice versa) and descending sequential rank (`rank(dest) - 1 === rank(source)`). Empty column accepts only `King` (rank 13).
    - Foundation: Stacking requires matching suit and ascending sequential rank (`rank(dest) + 1 === rank(source)`). Empty foundation accepts only `Ace` (rank 1).
    - Moving card sequences: Moving a face-up card from a tableau column moves all face-up cards stacked below it.
  - Auto-complete: Detects when stock and waste are empty and all tableau cards are face-up, providing a one-tap auto-solve animation.
  - Win detection: All 4 foundations hold 13 cards each.
- **`Commands.ts`**:
  - Full Undo/Redo stack storing reversible commands:
    - `MoveCardsCommand`
    - `DrawStockCommand`
    - `RecycleWasteCommand`
    - `FlipTableauCardCommand`
- **`HintEngine.ts`**:
  - Prioritizes: (1) Tableau/Waste card to Foundation, (2) Revealing a face-down Tableau card, (3) Moving King to empty Tableau column, (4) Beneficial Tableau to Tableau builds, (5) Stock draw.

### 4.2. 3D Graphics & Card Rendering (`src/gfx/`)

- **Card Mesh Geometry**:
  - Standard playing card aspect ratio (`width: 1.0`, `height: 1.4`, `depth: 0.008`).
  - Rounded corners via extruded 2D rounded rectangle shape or beveled box geometry.
- **Dynamic Procedural Textures**:
  - Generated on off-screen HTML5 canvases at 2x/3x retina DPI for razor-sharp pips, corner numbers, suit symbols, and classic royal figures (Jack, Queen, King).
  - Back texture: Classic blue/red intricate ornamental lattice pattern with white borders.
  - Edge material: Pure paper white/cream matte edge finish.
- **Lighting & Scene Setup**:
  - Deep casino green felt plane with subtle noise texture and vignette shader/edge darkening.
  - Subtle embossed/glowing card slots for Stock, Waste, 4 Foundations, and 7 Tableau columns.
  - `DirectionalLight` positioned top-left casting soft shadows (`THREE.PCFSoftShadowMap`).
  - Ambient fill light (`0.55`) for soft, clear card visibility.
- **Animation System**:
  - Cubic/sine easing curves for smooth realistic motion.
  - Flip animation: Y-axis rotation 0 to 180 degrees with subtle Z-elevation arc.
  - Move animation: Quadratic Bezier trajectory lifting card above other stacks during movement.
  - Win celebration: Dynamic physics cascade where cards bounce off foundations and tumble across the 3D table.

### 4.3. Mobile Input & Touch Controls (`src/input/`)

- **Raycasting & Pointer Events**:
  - Unified pointer events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) supporting touch, mouse, and stylus.
  - Threshold-based drag detection (`> 6px` movement triggers drag; otherwise registers as a tap).
- **Single-Tap Smart Move**:
  - On tap, checks for lowest valid move: (1) Foundation piles first, (2) Tableau columns second.
  - Triggers instant animated card glide if a move is found.
- **Multi-Card Drag & Drop**:
  - When dragging a card in a tableau stack, all cards beneath it are reparented to a temporary drag container group that tracks pointer movement along an invisible 3D plane.
  - Cards tilt dynamically in the drag direction and cast elevated drop shadows.
  - Dropping over a valid column/foundation snaps them into place; invalid drop smoothly returns them to the original position.
- **Responsive Camera Adapter**:
  - Automatically calculates perspective camera distance (`Z` depth) to fit all 7 tableau columns and top slots into portrait smartphone screens (`aspect ratio < 1.0`) without cropping or scrolling.

### 4.4. Procedural Audio Synthesis (`src/audio/`)

- Built-in Web Audio API synthesizer:
  - **`playDeal()`**: Short high-pass white noise burst with exponential volume decay (~40ms).
  - **`playSnap()`**: Snappy low-pass resonance click (~60ms) simulating physical card impact on felt.
  - **`playFlip()`**: Crisp flick tone (~80ms).
  - **`playUndo()`**: Descending soft dual-tone sine chime.
  - **`playWinFanfare()`**: Ascending pentatonic celebratory arpeggio.
- Global mute toggle in HUD.

### 4.5. Mobile HUD & UI Overlay (`src/ui/`)

- **Header Bar**:
  - Score, Move Counter, Timer (`MM:SS`), Draw Mode toggle (`Draw 1` / `Draw 3`), Sound mute button.
- **Bottom Action Bar**:
  - Large touch targets for thumb navigation: `Undo`, `Hint`, `Restart`, `New Game`.
- **End-Game Modal**:
  - Animated victory card, final score, total moves, elapsed time, and `Play Again` button.

---

## 5. Dockerization & Deployment

- **Port**: `9876` (both host and container).
- **Multi-Stage `Dockerfile`**:
  - Stage 1: `node:20-alpine` runs `npm ci` and `npm run build`.
  - Stage 2: `nginx:alpine` copies `/dist` to `/usr/share/nginx/html`, sets custom `nginx.conf` listening on `9876`, enables gzip compression, and configures SPA routing fallback.
- **`docker-compose.yml`**:
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

---

## 6. Testing & Quality Assurance Plan

1. **Unit Tests (Vitest)**:
   - Deck creation & shuffling logic (52 distinct cards, correct rank/suit distribution).
   - Klondike rules: legal vs illegal moves for Tableau and Foundation.
   - Multi-card cascade moves.
   - Stock dealing and recycling (Draw 1 and Draw 3).
   - Undo/Redo command stack integrity across multi-step sequences.
   - Auto-complete condition detection.
   - Hint solver accuracy.
2. **End-to-End Build & Container Verification**:
   - `npm run build` static bundle verification.
   - `docker build -t solitaire-3d .`
   - `docker run -d -p 9876:9876 solitaire-3d`
   - Healthcheck verification on `http://localhost:9876`.
