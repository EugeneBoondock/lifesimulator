# Aetheria Life Sim

A 3D AI-powered life simulation built with React, Three.js, and Google Gemini AI.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **3D Rendering**: Three.js via @react-three/fiber and @react-three/drei
- **AI**: Google Gemini AI (@google/genai)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite 5

## Project Structure

- `App.tsx` - Main application entry point
- `components/` - React components
  - `HumanoidModel.tsx` - 3D humanoid character model
  - `UIOverlay.tsx` - HUD and UI overlay
  - `World3D.tsx` - 3D world scene
- `services/` - AI and engine services
  - `aiMindEngine.ts` - AI mind coordination
  - `audioService.ts` - Audio handling
  - `behaviorEngine.ts` - Behavior logic
  - `geminiService.ts` - Gemini AI integration
  - `memoryStorage.ts` - Memory persistence
  - `neuroEngine.ts` - Neural simulation
  - `ollamaService.ts` - Ollama local AI integration
  - `subconsciousEngine.ts` - Subconscious AI processing
- `constants.ts` - App constants
- `types.ts` - TypeScript type definitions

## Environment Variables

- `GEMINI_API_KEY` - Google Gemini API key (required for AI features)

## Development

```bash
npm install
npm run dev
```

The app runs on port 5000.

## Deployment

Configured as a static site deployment:
- Build: `npm run build`
- Output: `dist/`
