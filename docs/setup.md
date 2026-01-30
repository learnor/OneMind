# Setup

## Prerequisites

- Node.js (LTS recommended)
- Expo CLI (via `npx expo`)
- A Supabase project
- A Google Gemini API key

## Install

1. Install dependencies:
   - `npm install`
2. Create `.env` from the template:
   - Copy `.env.example` to `.env`
3. Fill in required environment variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GEMINI_API_KEY`

Optional:
- `EXPO_PUBLIC_OPENAI_API_KEY` (if switching from Gemini)

## Validate Environment

- Run `node check-env.js` to validate the configuration.

## Run the App

- Start Metro: `npx expo start`
- iOS Simulator: `npm run ios` (requires Xcode)
- Android Emulator: `npm run android`
- Expo Go on device: scan the QR code from Expo CLI/DevTools

## Common Issues

- If the QR code fails to connect, ensure your phone and Mac are on the same Wi-Fi.
- If port 8081 is in use, stop the process or start on another port:
  - `npx expo start --port 8082`
- For LAN mode (recommended for device testing):
  - `npx expo start --lan`
