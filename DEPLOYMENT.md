# Deployment Guide

## 1. Cloudflare R2 (Storage)
### Setup (One-time)
1.  **Create Bucket:** `minilsm`
2.  **CORS Policy:**
    ```json
    [
      {
        "AllowedOrigins": [
          "http://localhost",
          "http://localhost:5173",
          "http://localhost:1420",
          "https://tauri.localhost",
          "tauri://localhost"
        ],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
      }
    ]
    ```
3.  **API Tokens:** Generate Admin Read/Write token.
4.  **Save Credentials:** Add to `.env.r2` in project root. as in `.env.example.r2`:
   

**Notes**
- The current Admin desktop app uploads to R2 from the React/WebView layer using the AWS SDK, so R2 CORS affects Admin uploads in both dev and release builds.
- If Windows release uploads fail with `Failed to fetch`, check the packaged app request origin in logs and add that origin to `AllowedOrigins`.
- Keep `AllowedOrigins` limited to exact origins you use for development and packaged builds.

## 2. Cloudflare Worker (Security Gateway)
### Authenticate
```bash
cd securestream-worker
npx wrangler login
```

### Configure
Edit `wrangler.toml`:
- Set `R2_BUCKET` binding to your bucket name.
- Set `JWT_SECRET` in `[vars]`.

### Deploy
```bash
npm run deploy
```

### Verify
- Copy the worker URL (e.g., `https://securestream-worker.yourname.workers.dev`) and save it in `worker.url`
- Save it for the frontend config.

## 3. Firebase Backend
### Prerequisites
- Node.js 18+ installed.
- Firebase CLI installed (`npm install -g firebase-tools`).

### Authenticate
```bash
npx firebase login
```

### Initialize (One-time)
```bash
npx firebase use --add
# Select your project alias (e.g., "prod")
```

### Configure Region (Paris - europe-west1)
The Firebase Cloud Functions are configured to run in the Paris region (`europe-west1`). This is already set in all function definitions:

**V2 API Functions** (generateToken, createVideo, bootstrapAdmin, grantAccess, revokeAccess):
```javascript
onCall({ region: 'europe-west1' }, async (request) => { ... })
```

**V1 Auth Trigger** (onUserCreate):
```javascript
functions.region('europe-west1').auth.user().onCreate(...)
```

To change the region, update the `region: 'europe-west1'` values in the respective function files in the `functions/` directory.

### Deploy
```bash
# Deploy everything (Firestore Rules + Functions)
npx firebase deploy --only firestore,functions
```

### One-time: Bootstrap an Admin user
New users default to `role: "student"` in Firestore. To promote your account:
1. Deploy Functions to Paris region: `npx firebase deploy --only functions`
2. Set `BOOTSTRAP_ADMIN_UID` in your environment (your Firebase Auth UID)
3. Call the callable function `bootstrapAdmin` once while signed in as that UID

Note: All Cloud Functions are deployed to the Paris region (europe-west1) for reduced latency in Europe.

## 4. Frontend (Web App)
### Prerequisites
- Node.js 18+ installed.
- Firebase CLI installed (`npm install -g firebase-tools`).

### Configure
1. **Firebase Web Configuration**
   - Get your Firebase config from Firebase Console → Project Settings → Web App Configuration.
   - Create `web-app/.env.local`:
     ```env
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
     ```

2. **Google OAuth Configuration (Firebase Console)**
   - Enable Google Sign-In provider in Firebase Authentication.
   - Add authorized redirect URIs:
     - `http://localhost:5173` (local development)
     - `http://localhost:5173/` (with trailing slash)
     - `https://your-domain.com` (production)
   - Copy the Web Client ID if needed for advanced configurations.

### Run Locally
```bash
cd web-app
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Build for Production
```bash
cd web-app
npm run build
```
This creates an optimized production build in `web-app/dist/`.

### Test Production Build Locally
```bash
cd web-app
npm run preview
```
Visit `http://localhost:4173` to test the production build.

### Deploy to Firebase Hosting
```bash
# From project root
npx firebase deploy --only hosting
```

**First-time Setup:**
```bash
npx firebase init hosting
# Choose your project
# Set public directory to: web-app/dist
# Configure as single-page app: Yes
```

### Verify Deployment
- Visit your Firebase Hosting URL: `https://your-project-id.web.app`
- Test login with Google OAuth
- Test video playback (requires test playlist + video in Firestore)

### Troubleshooting
- **CORS errors on video playback:** 
  - Verify `VITE_CLOUDFLARE_WORKER_URL` is correct
  - Check Worker CORS headers in `securestream-worker/src/index.js`
  
- **Login fails with "Unauthorized":**
  - Ensure your production domain is in Firebase Authorized Domains
  - Check Firebase Console → Authentication → Settings → Authorized Domains
  
- **Videos not loading on dashboard:**
  - Verify `playlistAccess` documents exist in Firestore for test user
  - Check browser console for Firestore permission errors
  - Verify test user's UID matches in `playlistAccess` collection


## 5. Admin App (Desktop)
### Configure
1. **R2 credentials**
   - Add these keys to `admin-app/.env.local`:
     - `VITE_R2_ACCOUNT_ID`
     - `VITE_R2_ACCESS_KEY_ID`
     - `VITE_R2_SECRET_ACCESS_KEY`
     - `VITE_R2_BUCKET_NAME`
     - `VITE_CLOUDFLARE_WORKER_URL`
2. **Firebase client config (Admin app)**
   - Create `admin-app/.env.local`:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
3. **Enable Email/Password auth (Admin login)**
  - Firebase Console → Authentication → Sign-in method → enable Email/Password.
4. **Provision admin accounts**
  - Create the admin user in Firebase Authentication (email/password).
  - Set `users/{uid}.role` to `admin` in Firestore.
  - Non-admin accounts are signed out immediately in the admin app.

### Run
```bash
cd admin-app
npm install
npm run dev
```

### Build (Linux)
Install Rust, Node.js, and Tauri system dependencies (GTK/WebKit2, OpenSSL) for your distro, then:
```bash
cd admin-app
npm install
npm run tauri build
```
Note: `npm run pretauri ...` now auto-prepares the correct FFmpeg sidecar for your current OS.

### Build (Windows)
Install Rust, Node.js, Visual Studio Build Tools (C++), and WebView2 Runtime, then:
```powershell
cd admin-app
npm install
npm run tauri build
```
Note: Build natively on Windows to package the Windows FFmpeg sidecar.

### Cross-compile (Linux -> Windows)
Possible but more fragile than a native Windows build. Use this only if you cannot build on Windows.

### Use
- Sign in with Email/Password.
- Enter a `playlistId`, add videos, and start the queue.
- The app processes videos to HLS, uploads the output folder to R2, then calls the Firebase callable `createVideo`.

### Troubleshooting (Windows release)
- **Error:** `Upload failed: Failed to upload 000.ts: Failed to fetch`
- **Likely cause:** R2 CORS does not include the packaged app origin.
- **What to check:** In app logs, capture the upload diagnostics fields (`origin`, `endpoint`, `key`) and verify `origin` is listed in R2 `AllowedOrigins`.
- **Fix:** Add the exact packaged origin (for example `https://tauri.localhost`) to R2 CORS and retry upload.
- **If still failing:** Re-check `VITE_R2_*` variables used at build time for the Windows release binary.

---

## Complete Deployment Checklist

### Phase 1: Infrastructure (R2 + Worker)
- [x] Create R2 bucket `minilsm`
- [x] Configure R2 CORS policy
- [x] Generate R2 API token
- [x] Create `.env.r2` with credentials
- [x] Deploy Cloudflare Worker
- [x] Save Worker URL for web-app config

### Phase 2: Backend (Firebase)
- [x] Create Firebase project in Console
- [x] Enable Firestore Database
- [x] Enable Firebase Authentication (Google provider)
- [x] Deploy Firestore Security Rules: `npx firebase deploy --only firestore`
- [x] Deploy Cloud Functions: `npx firebase deploy --only functions`
- [x] Bootstrap admin user (if needed)
- [x] Get Firebase Web config

### Phase 3: Frontend (Web App)
- [x] Create `web-app/.env.local` with Firebase + Worker config
- [x] Configure Google OAuth authorized domains in Firebase Console
- [x] Test locally: `npm run dev` at http://localhost:5173
- [x] Build production: `npm run build`
- [x] Deploy to Firebase Hosting: `npx firebase deploy --only hosting`
- [x] Verify at `https://your-project-id.web.app`

### Phase 4: Admin App (Desktop)
- [x] Create `admin-app/.env.local` with Firebase + R2 + Worker config
- [x] Test locally: `npm run dev`
- [x] Build for your OS: `npm run tauri build`

### Testing
- [x] Admin app: Upload video → HLS processing → R2 upload → Firestore entry
- [x] Web app: Login → See playlists → Click playlist → See videos → Play video
- [x] Video player: Verify HLS streaming, quality selector works
- [x] Mobile: Test responsive layout on tablet/phone

### Post-Deployment
- [ ] Monitor Firebase usage in Console
- [ ] Monitor Cloudflare Worker logs and costs
- [ ] Set up alerts for quota usage
- [ ] Regularly review Firestore security rules for edge cases
