# Pixivo-Studio

## projectOverview
Pixivo-Studio is a Next.js + React creative studio web application that provides a client UI (studio/workbench) and several backend API routes for image generation and uploads. The repository contains UI components, Studio pages, API route handlers, and database utilities (Drizzle ORM configuration and schema files).

### Project structure (selected)
- Root files
  - package.json
  - next.config.mjs
  - drizzle.config.js
- Public assets
  - public/*.png, .mp4, .svg (images & demos)
- App (Next.js App Router)
  - src/app/layout.js
  - src/app/page.js
  - src/app/studio/page.jsx
  - src/app/sentry-example-page/page.jsx
  - src/app/global-error.jsx
  - src/app/globals.css
- API routes (App Router)
  - src/app/api/generate-image/route.js
  - src/app/api/upload/route.js
  - src/app/api/test/route.js
  - src/app/api/sentry-example-api/route.js
- Components
  - src/components/*
  - src/components/studio/*
  - src/components/ui/*
- Database / ORM (Drizzle)
  - src/db/schema.js
  - src/db/index.js
  - src/db/generations.js
- Utilities & libs
  - src/lib/*
  - src/hooks/*
  - src/context/*

## features
- Studio workspace and workbench UI (src/components/studio/, src/app/studio/page.jsx)
- Image generation backend endpoint (src/app/api/generate-image/route.js)
- Upload endpoint for files (src/app/api/upload/route.js)
- Local test and Sentry example endpoints (src/app/api/test/route.js, src/app/api/sentry-example-api/route.js)
- Reusable UI primitives (src/components/ui/)
- Drizzle ORM schema and DB utilities (src/db/)
- Tailwind CSS styling (globals + Tailwind config present via postcss.config.mjs)

## installation
Prerequisites
- Node.js (LTS)
- npm (bundled with Node.js)

Install dependencies:
```bash
npm install
```

Common scripts (defined in package.json):
- Start development server:
```bash
npm run dev
```
- Build for production:
```bash
npm run build
```
- Start production server:
```bash
npm start
```

Note: The repository uses the Next.js App Router (src/app) and Drizzle ORM configuration (drizzle.config.js). If you integrate a database, ensure your environment and Drizzle config are set accordingly.

## usage
Run the development server:
```bash
npm run dev
```
Open the app in your browser (default Next.js port):
- http://localhost:3000/ — main app
- http://localhost:3000/studio — Studio workbench page
- http://localhost:3000/sentry-example-page — Sentry example page

Routes and behavior for server endpoints are implemented in the corresponding files under src/app/api/* — inspect those files to learn required request payloads and response formats.

Build and run production:
```bash
npm run build
npm start
```

## techStack
- Next.js (App Router)
- React
- Tailwind CSS
- Drizzle ORM
- Node.js / npm
- PostCSS

Badges (representative)
![Next.js](https://img.shields.io/badge/next.js-000000?style=flat&logo=next.js)
![React](https://img.shields.io/badge/react-61DAFB?style=flat&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-06B6D4?style=flat&logo=tailwind-css&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/drizzle-fff?style=flat)

## apiReference
The repository includes App Router API route handlers. Table lists each exposed route and its source file path. For request methods, payloads, and response schemas, inspect the referenced route.js files.

| Route path | Source file | Notes |
|---|---:|---|
| /api/generate-image | src/app/api/generate-image/route.js | Image generation handler implementation lives here. |
| /api/upload | src/app/api/upload/route.js | File upload handling implementation. |
| /api/test | src/app/api/test/route.js | Local test endpoint. |
| /api/sentry-example-api | src/app/api/sentry-example-api/route.js | Sentry example API endpoint. |

All API handlers live under src/app/api/* (App Router). Review those files for authentication, input format, and response details before calling from clients or integrating into other services.

## license
No LICENSE file found in the repository. No license is specified. Add a LICENSE file at the project root to define usage and distribution terms.