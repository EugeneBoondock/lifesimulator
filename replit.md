# Aetheria AI Life Simulator

A 3D AI-powered life simulation where unique creatures called "Aetheri" start with nothing and discover technologies to advance through 5 eras of civilization.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **3D Rendering**: Three.js via @react-three/fiber and @react-three/drei
- **AI**: DeepSeek API (OpenAI-compatible) via Express backend proxy
- **Styling**: Tailwind CSS + glassmorphism UI
- **Build Tool**: Vite 5

## Architecture

### Frontend (port 5000)
- **App.tsx** - Main game loop, state management, physics, collision detection
- **components/World3D.tsx** - 3D canvas with terrain, lighting, weather, water, day/night cycle
- **components/Environment.tsx** - Flora (20 types), fauna (7 types), buildings (13 types) 3D models
- **components/CreatureModel.tsx** - Aetheri creature 3D model with animations
- **components/UIOverlay.tsx** - Glassmorphism HUD: stats, tech tree, agent inspector, event log

### Backend (port 3001)
- **server/index.ts** - Express server proxying DeepSeek API calls
  - POST `/api/ai/decide` - Agent decision making
  - POST `/api/ai/batch` - Batch decisions
  - GET `/api/health` - Health check

### Services
- **services/deepseekService.ts** - AI decision engine with context-aware prompts, rate limiting
- **services/worldEngine.ts** - Game simulation: needs, combat, crafting, building, tech discovery
- **services/memoryStorage.ts** - IndexedDB persistence for agent memories

### Core Data
- **types.ts** - Full type system (Agent, Era, Technology, Flora, Fauna, Building, etc.)
- **constants.ts** - Tech tree (15 techs), crafting recipes, building recipes, world generation

## Game Systems

### Technology Tree (5 Eras)
1. **Primitive** (The Awakening) - Starting era, no technologies
2. **Stone Age** (Age of Stone) - Fire, Stone Knapping, Cooking, Shelter, Spear Making, Weaving
3. **Agricultural** (Age of Growth) - Pottery, Agriculture, Animal Husbandry
4. **Bronze Age** (Age of Bronze) - Masonry, Copper Smelting, Bronze Working, Writing
5. **Iron Age** (Age of Iron) - Iron Smelting, Engineering

### Agent AI
- DeepSeek API provides context-aware decisions
- Agents consider: needs (hunger, thirst, energy, temperature, safety, social, curiosity), personality traits, memories, nearby resources/threats
- Technology discovery through experimentation (RESEARCH action)
- Social interactions, teaching, and knowledge sharing

## Environment Variables

- `DEEPSEEK_API_KEY` - DeepSeek API key (required)

## Development

```bash
npm run dev       # Starts backend (port 3001) + frontend (port 5000)
npm run dev:server  # Backend only
npm run dev:frontend  # Frontend only
```

Vite proxies `/api/*` requests to the backend server.

## Deployment

Static site deployment:
- Build: `npm run build`
- Output: `dist/`
- Backend must be deployed separately for AI features
