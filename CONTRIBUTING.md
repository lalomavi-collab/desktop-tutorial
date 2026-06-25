# Contributing to LAWDIN

Welcome. This guide explains how to set up the web application that lives in ldr/web, how to run it on your machine, and how to propose changes through Pull Requests.

## Project location

The web client is a React, Vite, and TypeScript application located in the ldr/web directory. All of the commands below assume that you have already changed into that directory:

```bash
cd ldr/web
```

## Prerequisites

Before you start, make sure the following tools are installed:

1. Node.js version 18 LTS or newer. Vite 5 requires Node 18 or above. You can check your version with `node --version`.
2. npm, which ships with Node.js. This project uses npm as its package manager (a `package-lock.json` file is committed under ldr/web). You can check your version with `npm --version`.
3. A Supabase project, so that the application can authenticate users and read data. See the Environment variables section below.

Note. Because the repository commits an npm lockfile, please use npm rather than yarn or pnpm so that everyone resolves the same dependency versions.

## Installing dependencies

From inside the ldr/web directory, run:

```bash
npm install
```

This reads `package.json` and `package-lock.json` and installs all dependencies and dev dependencies, including React, Supabase JS, Leaflet, MapLibre, Vite, and TypeScript.

## Running the application locally

Start the Vite development server with:

```bash
npm run dev
```

By default the server listens on port 5173, so open your browser at http://localhost:5173 once Vite reports that it is ready. The dev server supports hot module replacement, so most edits appear in the browser without a manual refresh.

Other useful scripts defined in package.json:

1. `npm run build` compiles the TypeScript project and produces a production bundle.
2. `npm run preview` serves the production bundle locally so you can verify a build before shipping.

## Environment variables

The application reads its configuration from Vite environment variables, which must be prefixed with VITE_ so that Vite exposes them to the browser. A template is provided at ldr/web/.env.example.

To configure your local environment, copy the example file and fill in your own values:

```bash
cp .env.example .env
```

The following variables are required:

1. VITE_SUPABASE_URL. The base URL of your Supabase project, for example https://your_project_ref.supabase.co.
2. VITE_SUPABASE_ANON_KEY. The public anon (publishable) key for your Supabase project.

### Where to obtain these values

Both values come from the Supabase dashboard:

1. Sign in at https://supabase.com and open the project that the team is using (ask a maintainer for an invite if you do not have access).
2. Open Project Settings, then the API section.
3. Copy the Project URL into VITE_SUPABASE_URL.
4. Copy the anon public key into VITE_SUPABASE_ANON_KEY.

Important security notes:

1. Never commit a real .env file. Only .env.example, which contains placeholders, belongs in version control. The .env file is intended to stay on your machine only.
2. Only the anon (publishable) key belongs in the front end. Never place the Supabase service role key, or any other secret key, in this application or in any committed file, because everything prefixed with VITE_ is shipped to the browser and is publicly visible.
3. If you ever expose a real key by accident, rotate it in the Supabase dashboard right away.

## Opening a Pull Request

We do not push directly to main. All changes flow through Pull Requests so that they can be reviewed.

1. Create a feature branch from an up to date main, for example `git checkout -b your_name/short_description`.
2. Make your changes and commit them with a clear message that explains the intent.
3. Run `npm run build` inside ldr/web to confirm the project still compiles and type checks pass.
4. Push your branch and open a Pull Request that targets main. The Pull Request template will load automatically; please fill in the description, the testing notes, and the checklist.
5. Keep your branch up to date with main. If main moves ahead, merge or rebase main into your branch and resolve any conflicts.

## The review process

1. Every Pull Request needs at least one approving review from another contributor before it can be merged.
2. Reviewers look at correctness, readability, security (especially around Supabase keys and access rules), and whether the change matches the description.
3. Address review feedback by pushing additional commits to the same branch. Resolve each conversation once it has been handled.
4. Once the Pull Request has the required approval and is up to date with main, a maintainer merges it. Prefer a squash merge so that main keeps a clean history.

Thank you for contributing.
