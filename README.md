# 🍳 Yummy — Mobile App

Cross-platform mobile app that turns a photo of your fridge or pantry into personalized AI-generated recipes.

Built with React Native and Expo, Yummy lets users snap a photo and instantly get recipes tailored to what they have on hand — no manual ingredient entry required. This is the client for the [yummy backend](https://github.com/YOUR-USERNAME/yummy).

## 🎯 How It Works

- 📷 **Scan or Upload** — Take a live photo via the in-app camera, or upload one from your library
- ⚡ **Auto-Analysis** — The photo is sent to the backend automatically on capture — no extra submit step
- 🍽️ **Instant Recipes** — Returns AI-generated recipes with instructions, nutrition info, and category tags
- ⭐ **Rate & Comment** — Leave star ratings and comments on any recipe
- ❤️ **Favorite & Organize** — Save favorites, browse by category, search, and sort your recipe library

## 📁 Project Structure
yummy-mobile/
├── App.js # Full app: navigation, camera, UI, API calls
├── app.json # Expo configuration
└── dist/ # Production web build (generated via expo export)

## 🚀 Quick Start

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app (iOS/Android) to run on a physical device, or press `w` to open the web version.

**Production web build:**

```bash
npx expo export --platform web
```

Deploys the generated `dist/` folder to any static host (Netlify, Vercel, etc.).

## ✨ Features

- 📸 **Dual Capture Flow** — Live camera with front/back toggle, plus a file-upload fallback
- 🗂️ **Categorized, Searchable Library** — Recipes auto-tagged by meal type, filterable via chips, searchable by name/description, sortable by newest/top-rated/quickest
- ⭐ **Ratings & Comments** — Full community feedback UI with live-updating averages
- ❤️ **Favorites** — One-tap favoriting with a dedicated tab
- 👉 **Swipe-to-Delete** — Native-feeling gesture-based recipe deletion via `react-native-gesture-handler`
- 🏆 **Chef's Pick Badge** — Automatically highlights the highest-rated recipe
- 📊 **Profile Dashboard** — Personal stats (total recipes, ratings given, category breakdown)
- 🎨 **Custom Design System** — Warm, categorized color palette, haptic feedback, skeleton loading states, and pull-to-refresh throughout
- 🌐 **True Cross-Platform** — Single codebase ships to iOS, Android, and web via Expo

## 🧗 Challenges & What I Learned

- **Mobile-to-backend connectivity**: Diagnosed a multi-layered networking issue affecting device-to-device requests — including a missing backend host binding and a manually-set `Content-Type` header that broke the multipart upload boundary. Resolved by removing the header entirely and letting `fetch` generate the correct boundary automatically.
- **iOS local network permissions**: iOS silently blocks first-time local-network requests until the user grants a system-level permission prompt, producing a generic, hard-to-diagnose network error when missed.
- **Virtual environment path fragility** (on the backend side, surfaced while integrating): learned to treat Python venvs as non-portable — activation can silently fail after moving a project directory, since `activate` hardcodes absolute paths at creation time.

## 🏆 Accomplishments

- Shipped a cross-platform mobile experience (iOS/Android/web) from a single codebase using Expo
- Built a fully gesture-driven UI (swipe-to-delete, tap-to-favorite, pull-to-refresh) matching native app conventions
- Designed and implemented a custom design system from scratch, including a category-based color palette and reusable animated components
- Connected to a live, deployed backend, making the app usable from any network rather than only local WiFi

## 🏗️ Architecture

- **React Native (Expo)** — cross-platform UI framework
- **expo-camera / expo-image-picker** — photo capture and upload
- **react-native-gesture-handler** — swipe interactions
- **expo-haptics** — tactile feedback
- **expo-linear-gradient** — custom UI theming
