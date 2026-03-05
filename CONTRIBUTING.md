# Contributing to SecureStream LMS

Thank you for your interest in contributing! 🎉

## How to Contribute

1. **Fork** the repository and create your branch from `main`.
2. **Clone** your fork locally and install dependencies (see [DEPLOYMENT.md](./DEPLOYMENT.md) for setup).
3. **Make your changes** — keep commits focused and well-described.
4. **Test** your changes locally before submitting.
5. **Open a Pull Request** with a clear description of what you changed and why.

## Development Setup

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full environment setup instructions.

Quick local start:
```bash
# Web App
cd web-app && npm install && npm run dev

# Admin App
cd admin-app && npm install && npm run tauri dev

# Cloud Functions (emulator)
cd functions && npm install
firebase emulators:start --only functions
```

## Guidelines

- **Keep PRs focused** — one feature or fix per PR.
- **Follow existing code style** — the project uses ESLint/Prettier for JS and `rustfmt` for Rust.
- **Describe your changes** — explain *why* the change is needed, not just *what* it does.
- **Security issues** — please report security vulnerabilities privately via GitHub's Security Advisory feature rather than opening a public issue.

## Questions?

Open a GitHub Issue or start a Discussion. Contributions of all sizes are welcome!
