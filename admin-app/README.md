# Admin Desktop App (Tauri + React)

Desktop admin application for video processing (HLS), R2 upload, and metadata creation.

## Environment

Create `admin-app/.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_R2_ACCOUNT_ID=
VITE_R2_ACCESS_KEY_ID=
VITE_R2_SECRET_ACCESS_KEY=
VITE_R2_BUCKET_NAME=

VITE_CLOUDFLARE_WORKER_URL=
```

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run tauri build
```

`npm run tauri ...` auto-runs FFmpeg sidecar preparation for the current OS.

## Cross-platform notes

- Build natively on each target OS for best results.
- Video processing temp files are written under the OS temp directory.
- Admin login uses Firebase Email/Password auth.
