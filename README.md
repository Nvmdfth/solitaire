# 3D Mobile-Oriented Klondike Solitaire

A realistic, high-performance 3D Klondike Solitaire game built with **Three.js**, **TypeScript**, and **Vite**. Designed from the ground up for mobile touchscreens (with seamless desktop/tablet support), featuring deterministic seed generation, a Thoughtful Klondike A* solver, procedural vector graphics and audio, and zero external media dependencies.

---

## Features

### 🎴 Realistic 3D Graphics & Animations
- **Physical Card Geometry**: 3D card meshes with realistic physical dimensions, thickness, rounded corners, and beveled edges.
- **Procedural Vector Faces**: Canvas-rendered crisp court cards and suit pips; no external PNG/JPG downloads.
- **Casino Felt Tabletop**: Dynamic soft shadows, ambient lighting, and subtle slot placement guides.
- **Fluid Motion**: 3D dealing arcs, parabolic glide moves, stack tilts on drag, card flip transitions, and an explosive victory cascade celebration on win.

### 🧠 Deterministic Seed Generation & Winnable Solitaire Guarantee
- **Mulberry32 PRNG & FNV-1a Hashing**: Uniform 32-bit pseudo-random number generator for reproducible deck shuffles from any numeric or alphanumeric seed (`src/core/PRNG.ts`).
- **Guaranteed Winnable Deals**: Instant (<1ms) catalog deals combined with an embedded Thoughtful Klondike A* solver fallback (`src/core/GameGenerator.ts`).
- **Seamless Seed Sharing**: Seed pill button in HUD with an interactive modal to input custom seeds, roll guaranteed winnable games, or copy direct challenge links (`?seed=...`).
- **Offline Seed Discovery Scanner**: Dedicated CLI (`npm run seeds:scan`) to analyze seeds, benchmark solvability rates, and extract unwinnable blacklists.

### 📱 Mobile-First Controls & UX
- **Responsive Frustum**: Auto-adjusting camera bounds accommodating mobile portrait ratios without card clipping.
- **Dual Input Modes**: Fluid multi-card drag-and-drop raycasting alongside single-tap auto-move (smart assist) to foundations and tableau columns.
- **Thumb-Friendly HUD**: Bottom-anchored mobile controls for **Undo**, **Hint**, **Restart**, and **New Game**, plus top status bar displaying Timer, Score, Moves, and Seed.
- **Draw-1 & Draw-3 Modes**: Flexible Klondike rule configurations with live mode toggling.

### 🔊 Procedural Audio & Session Persistence
- **Web Audio API Synthesis**: Zero-asset audio engine generating realistic card swooshes, snap clicks, flip noises, and victory fanfares.
- **Session Auto-Save**: Seamless cookie state persistence restoring ongoing tableau, stock, score, and timer across browser refreshes.

---

## Architecture & Directory Overview

```
solitaire/
├── index.html                           # Single-page application entry point
├── public/                              # Static public assets
├── docs/                                # Technical specifications and architecture
│   ├── SEEDED_WINNABLE_GAMES.md         # In-depth solver, PRNG, and catalog documentation
│   └── superpowers/                     # Implementation plans and architecture design specs
├── scripts/                             # Utility scripts and CLI tools
│   ├── find_unwinnable_seeds.ts         # Seed discovery & solvability scanner CLI
│   ├── test_ui_e2e.js                   # Mobile touch Puppeteer E2E validation suite
│   └── validate_session_persistence.js  # Headless browser session persistence validator
├── src/
│   ├── audio/                           # Web Audio API procedural synthesis
│   │   └── SoundEffects.ts
│   ├── core/                            # Pure TypeScript headless game engine
│   │   ├── Card.ts                      # Card models, suits, and rank helpers
│   │   ├── Commands.ts                  # Command pattern undo/redo stack
│   │   ├── Deck.ts                      # Deck factory and Fisher-Yates shuffle
│   │   ├── GameGenerator.ts             # Winnable game generator & blacklist filter
│   │   ├── GameState.ts                 # Klondike state machine and rule verification
│   │   ├── HintEngine.ts                # Heuristic hint suggestion engine
│   │   ├── PRNG.ts                      # Mulberry32 PRNG and FNV-1a hash functions
│   │   ├── Scoring.ts                   # Standard Klondike scoring and timer
│   │   ├── SessionStorage.ts            # Cookie/localStorage serialization
│   │   ├── types.ts                     # Core domain interfaces
│   │   ├── data/
│   │   │   └── seedFixtures.ts          # Known winnable/unwinnable seed fixtures
│   │   └── solver/
│   │       ├── KlondikeSolver.ts        # A* solver, dominance pruning, transposition table
│   │       └── SolverTypes.ts           # Solver contracts and solution move interfaces
│   ├── gfx/                             # Three.js 3D rendering pipeline
│   │   ├── AnimationManager.ts          # Tweening, cascades, and card glides
│   │   ├── Card3D.ts                    # Object3D wrapper and orientation controllers
│   │   ├── CardMeshFactory.ts           # Procedural canvas textures and rounded geometry
│   │   ├── SceneManager.ts              # Three.js scene, camera, lights, and resize handling
│   │   └── Tabletop.ts                  # Felt table surface and slot bounding boxes
│   ├── input/                           # Raycasting and interaction management
│   │   ├── DragPlane.ts                 # Math plane for pointer drag tracking
│   │   └── InteractionManager.ts        # Touch/click routing and multi-card drag logic
│   ├── ui/                              # DOM HUD overlays and modals
│   │   ├── HUD.ts                       # Header bar, seed modal, and thumb-friendly toolbar
│   │   ├── WinCelebration.ts            # Victory overlay and stats banner
│   │   └── styles.css                   # Responsive dark casino styling
│   └── main.ts                          # Application orchestrator and loop
├── tests/                               # Vitest unit and integration test suites
│   ├── cardfactory.test.ts              # Canvas card texture factory tests
│   ├── commands.test.ts                 # Undo/redo command pattern tests
│   ├── deck.test.ts                     # Deck creation and shuffle tests
│   ├── gamegenerator.test.ts            # Winnable game generation and blacklist tests
│   ├── gamestate.test.ts                # State transitions and rule validation tests
│   ├── hintengine.test.ts               # Move analysis and hint tests
│   ├── prng.test.ts                     # Mulberry32 and FNV-1a reproducibility tests
│   ├── sessionstorage.test.ts           # Cookie serialization tests
│   └── solver.test.ts                   # KlondikeSolver A* and dominance pruning tests
├── Dockerfile                           # Multi-stage production container build
├── docker-compose.yml                   # Container service configuration (port 9876)
├── nginx.conf                           # High-performance static web server config
├── package.json                         # Dependencies and build scripts
├── tsconfig.json                        # TypeScript strict compiler options
└── vite.config.ts                       # Vite bundler configuration
```

For complete technical details on the solver heuristics, state hashing, and PRNG mathematics, see the [Technical Architecture Documentation](docs/SEEDED_WINNABLE_GAMES.md).

---

## Quickstart & Development

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+ recommended)

### Installation
```bash
npm install
```

### Local Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser at `http://127.0.0.1:9876`.

### Production Build & Preview
Compile TypeScript and generate optimized static assets:
```bash
npm run build
npm run preview
```
The preview server will be accessible at `http://localhost:9876`.

---

## Testing & Verification

### Unit & Integration Tests (Vitest)
Run all 67 unit and integration tests across 9 suites:
```bash
npm run test:run
```

Watch mode for active development:
```bash
npm run test
```

### End-to-End Mobile Interaction Tests (Puppeteer)
Execute headless browser touch and interaction validation:
```bash
npm run test:e2e
```

---

## Seed Generation & Solver CLI

The project includes a standalone CLI scanner to evaluate seed solvability, verify winnable percentages, and generate seed catalogs:

```bash
# Scan 50 seeds starting from seed 1
npm run seeds:scan

# Scan custom range with state budget and JSON output
npm run seeds:scan -- --start 100 --count 200 --max-states 10000 --timeout 2000 --output seeds-report.json
```

### CLI Arguments
| Flag | Default | Description |
|---|---|---|
| `--start <n>` | `1` | Starting 32-bit unsigned seed integer |
| `--count <n>` | `50` | Total number of sequential seeds to evaluate |
| `--max-states <n>` | `5000` | Search node expansion budget per seed |
| `--timeout <ms>` | `2000` | Wall-clock execution timeout in milliseconds per seed |
| `--output <path>` | *None* | Path to export detailed JSON results and telemetry |
| `--update-fixtures` | `false` | Automatically merge and persist discovered seeds into `src/core/data/seedFixtures.ts` |

---

## Docker Deployment

Deploy the pre-configured production Nginx container:

```bash
# Build and start container in the background
docker compose up -d --build

# View container status
docker compose ps

# Check logs
docker compose logs -f
```

The game will be available at `http://<host-ip>:9876`.

---

## Seed Sharing Guide

1. **Viewing Current Seed**: The active seed appears in the top header pill (e.g., `#2`, `#142`). Text seeds entered by the player are hashed into an unsigned 32-bit integer displayed in the badge.
2. **Opening Seed Modal**: Click or tap the seed badge in the header.
3. **Playing Custom Seeds**: Type any numeric integer or text phrase into the custom seed field and click **Play Seed**. Text strings are hashed deterministically using FNV-1a.
4. **Copying Share Links**: Click **Copy Share Link** to generate a direct URL (e.g., `https://domain/?seed=42`). Anyone opening this link will be dealt the exact same deck layout.
5. **Requesting a Winnable Deal**: Click **New Winnable Game** to immediately generate a certified solvable deal via the game generator.
