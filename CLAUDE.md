# CLAUDE.md

## Project Overview

GitHub Desktop tutorial repository — a starter project for learning Git and GitHub workflows.

## Tech Stack

- TypeScript
- Next.js
- Tailwind CSS
- ShadCN UI

## Architecture

```
/app          — Next.js App Router pages and layouts
/components   — Reusable React components
/lib          — Utility functions and shared logic
/styles       — Global styles and design tokens
/public       — Static assets
```

### Key Patterns

- **App Router**: Use Next.js App Router (`/app`) for routing and layouts
- **Server Components**: Default to React Server Components; use `"use client"` only when needed
- **Colocation**: Keep components, hooks, and utils close to where they are used

## Coding Rules

- Use functional React components (no class components)
- Prefer server components over client components
- Use Tailwind utility classes instead of custom CSS
- Keep components small and focused on a single responsibility
- Use TypeScript strict mode — avoid `any` types
- Name files in kebab-case (e.g., `user-profile.tsx`)
- Name components in PascalCase (e.g., `UserProfile`)

## Design System

- Follow ShadCN component patterns and conventions
- Use design tokens from `/styles/tokens.ts` for colors, spacing, and typography
- Maintain consistent spacing and sizing via Tailwind's default scale
- Prefer ShadCN primitives over custom UI components

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run linter
npm run test      # Run tests
```
