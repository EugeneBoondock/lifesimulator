# Aetheria AI Life Simulator

A 3D AI-powered life simulation ("The Sims for AI species") where unique creatures called "Aetheri" are powered by DeepSeek AI. They breed, age, die, form relationships/partnerships, discover technologies across 5 eras, build settlements, experience world events, and live complete AI-driven lives in a beautiful 3D world.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **3D Rendering**: Three.js via @react-three/fiber and @react-three/drei
- **AI**: DeepSeek API (OpenAI-compatible) via Express backend proxy
- **Styling**: Tailwind CSS + glassmorphism UI
- **Build Tool**: Vite 5
- **Icons**: lucide-react

## Architecture

### Frontend (port 5000)
- **App.tsx** - Main game loop with full lifecycle: reproduction, aging, death, events, settlements, courtship, combat, collision resolution, AI integration
- **components/World3D.tsx** - 3D canvas with terrain, lighting, weather, water, day/night cycle, settlement boundaries, event visuals, follow/cinematic cameras, seasonal particles
- **components/Environment.tsx** - Flora (20 types), fauna (7 types), buildings (13 types) 3D models
- **components/CreatureModel.tsx** - Aetheri creature model with 22 distinct state animations, particle effects, life stage scaling, pregnancy visuals
- **components/UIOverlay.tsx** - Full HUD: world info, mini-map, population sparkline, agent inspector with family tree, settlements panel, event banners, era progress, event log

### Backend (port 3001)
- **server/index.ts** - Express server proxying DeepSeek API calls
  - POST `/api/ai/decide` - Agent decision making
  - POST `/api/ai/batch` - Batch decisions
  - GET `/api/health` - Health check

### Services
- **services/deepseekService.ts** - AI decision engine with enriched prompts (family, relationships, events, life stage), 16 action types
- **services/worldEngine.ts** - Full simulation engine: needs, combat, crafting, building, tech discovery, reproduction, aging, settlements, world events
- **services/memoryStorage.ts** - IndexedDB persistence for agent memories

### Core Data
- **types.ts** - Full type system (Agent with lifecycle fields, Settlement, ActiveEvent, CameraMode, PopulationSnapshot, LifeStage, RelationshipType)
- **constants.ts** - Tech tree (15 techs), crafting recipes, building recipes, world generation, name generators, population constants

## Game Systems

### Technology Tree (5 Eras)
1. **Primitive** (The Awakening) - Starting era, no technologies
2. **Stone Age** (Age of Stone) - Fire, Stone Knapping, Cooking, Shelter, Spear Making, Weaving
3. **Agricultural** (Age of Growth) - Pottery, Agriculture, Animal Husbandry
4. **Bronze Age** (Age of Bronze) - Masonry, Copper Smelting, Bronze Working, Writing
5. **Iron Age** (Age of Iron) - Iron Smelting, Engineering

### Life Cycle System
- **Birth**: Agents reproduce with genetics (inherited traits from parents, mutations)
- **Life Stages**: CHILD (0-15 days, 0.7 scale) → ADULT (15-60 days, 1.0 scale) → ELDER (60+ days, 0.9 scale)
- **Death**: Old age (increasing chance after MAX_AGE_DAYS=85), starvation, dehydration, combat, events
- **Population cap**: MAX_POPULATION=20
- **Pregnancy**: ~200 ticks duration, baby name generation

### Relationships & Social
- **Relationship Types**: FRIEND, RIVAL, PARTNER, PARENT_REL, CHILD_REL, STRANGER
- **Courtship**: Adults with relationship > 40, opposite sex, unpartnered can court
- **Partnerships**: Form after successful courting period
- **Combat**: Agent-vs-agent fighting with damage calculation
- **Food Sharing**: Increases bonds between agents
- **Teaching**: Knowledge transfer of technologies

### Settlements
- Auto-detected from building clusters (3+ buildings, 2+ agents within radius)
- Fantasy name generation
- Visible as glowing boundary rings with 3D labels in world
- Listed in UI settlements panel

### World Events (9 types)
- PREDATOR_WAVE, RESOURCE_BOUNTY, DISEASE_OUTBREAK, EARTHQUAKE, WILDFIRE, METEOR, DROUGHT, MIGRATION, FESTIVAL
- Random occurrence, weighted by era
- Visual effects in 3D world (fire glow, meteor light, earthquake rings, disease aura)
- Event banners in UI

### Agent AI (16 actions)
- **Survival**: GATHER, HUNT, EAT, DRINK, SLEEP, FLEE, DEFEND
- **Social**: TALK, RESPOND, COURT, MATE, SHARE_FOOD, FIGHT_AGENT, PLAY
- **Building**: CRAFT, BUILD, RESEARCH, EXPLORE, WANDER
- Context includes: family info, settlement membership, active events, nearby relationships, age/life stage

### Camera Modes
- **FREE**: Standard orbit controls
- **FOLLOW**: Smoothly tracks selected agent
- **CINEMATIC**: Auto-follows interesting actions (fighting, hunting, celebrations)

### Creature Animations (22 states)
IDLE, MOVING, GATHERING, CRAFTING, BUILDING, EATING, DRINKING, SLEEPING, FIGHTING, HUNTING, RESEARCHING, TEACHING, SOCIALIZING, FLEEING, EXPLORING, THINKING, COURTING, MATING, PLAYING, MOURNING, CELEBRATING, DEFENDING

### UI Panels
- World info (era, time, population, births/deaths)
- Camera & speed controls
- Mini-map (2D canvas with agent dots, buildings, water)
- Population sparkline
- Agent inspector (needs bars, family tree, relationships, inventory, skills, AI thoughts, personality)
- Settlements panel
- Event banners
- Era progress bar
- Scrollable event log

## Environment Variables

- `DEEPSEEK_API_KEY` - DeepSeek API key (required)

## Development

```bash
npm run dev       # Starts backend (port 3001) + frontend (port 5000)
npm run dev:server  # Backend only
npm run dev:frontend  # Frontend only
```

Vite proxies `/api/*` requests to the backend server.

## Key Constants
- TICK_RATE_MS: 100ms per tick
- DAY_LENGTH_TICKS: 600 ticks per day
- MAX_POPULATION: 20
- CHILD_AGE_DAYS: 15, ELDER_AGE_DAYS: 60, MAX_AGE_DAYS: 85
- PREGNANCY_DURATION: 200 ticks
- WORLD_SIZE: 100
