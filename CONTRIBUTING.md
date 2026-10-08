# Contributing to Sidelines

Thanks for your interest in contributing! Sidelines is a tournament scoring and
live results platform for ultimate frisbee. This document explains how to get
set up and what we expect from contributions.

## Getting started

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/sidelines.git
   cd sidelines
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   The app is available at `http://localhost:3000`.

## Project structure

- `src/app` — Next.js App Router pages (public site, events, auth, dashboards)
- `src/components` — shared UI components (events, dashboard, chrome)
- `src/features` — feature-specific components (auth forms)
- `src/lib` — data, validators, and helpers
- `src/types` — shared TypeScript types

## Making changes

- Create a branch for your work:

  ```bash
  git checkout -b feature/my-change
  ```

- Follow the existing code style. The project uses TypeScript and Tailwind CSS;
  prefer extending the shared design tokens (CSS variables in
  `src/app/globals.css`) over hard-coding colors.
- Keep animations light and respect `prefers-reduced-motion`.
- Make sure the production build passes before opening a PR:

  ```bash
  npm run build
  ```

## Pull requests

- Open your PR against the `main` branch.
- Fill in the pull request template: what changed, why, and how to test it.
- Keep PRs focused — one logical change per PR when possible.
- Screenshots or short recordings are appreciated for UI changes.

## Reporting bugs

Use the bug report issue template and include:

- What you expected and what actually happened
- Steps to reproduce
- Browser and operating system

## Suggesting features

Use the feature request template. Describe the problem first, then your
suggested solution.

## Code of conduct

By participating in this project you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is **not open source**. The source code is publicly viewable for
study only — see [LICENSE](LICENSE). By contributing, you agree that your
contributions are licensed under the same terms and remain the property of the
copyright holder.
