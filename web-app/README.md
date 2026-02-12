# cheapLMS Web App

Student-facing React web application for cheapLMS - a cost-optimized private video streaming platform.

## Setup

### 1. Install Dependencies

```bash
cd web-app
npm install
```

**Dependencies installed:**
- `react` & `react-dom`: UI framework
- `react-router-dom`: Client-side routing
- `firebase`: Backend services (Auth, Firestore, Functions)
- `hls.js`: HLS video player
- `tailwindcss`: Utility-first CSS framework
- `vite`: Fast build tool and dev server

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Firebase Configuration (get from Firebase Console)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Cloudflare Worker URL (for video streaming)
VITE_CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
```

**Where to get these values:**
- Firebase credentials: Firebase Console → Project Settings → Web App Configuration
- Worker URL: Cloudflare Dashboard → Workers → Your worker domain

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Project Structure

```
src/
├── components/
│   ├── Navigation.jsx        # Top navbar with user menu
│   ├── PlaylistCard.jsx      # Course card component
│   ├── VideoList.jsx         # Video list modal
│   └── VideoPlayer.jsx       # HLS video player with quality selector
├── context/
│   └── AuthContext.jsx       # Firebase auth state management
├── hooks/
│   └── useVideoToken.js      # Token request & refresh logic
├── lib/
│   └── firebase.js           # Firebase initialization
├── pages/
│   ├── LoginPage.jsx         # Google OAuth login
│   ├── DashboardPage.jsx     # Course list & video browser
│   └── PlayerPage.jsx        # Video player page
├── App.jsx                   # Router setup
├── main.jsx                  # Entry point
└── index.css                 # Tailwind + global styles
```

## Features

### Phase 3: Web Application (Complete)

✅ **Task 3.1:** React Project Setup (Vite)
- Vite build tool with React plugin
- Tailwind CSS configured
- Environment variables set up

✅ **Task 3.2:** Firebase Authentication
- Google OAuth login via Firebase
- Session persistence with `onAuthStateChanged`
- Protected routes (unauthenticated users redirect to login)

✅ **Task 3.3:** Layout & Navigation
- Responsive navigation bar with user avatar and dropdown menu
- Dashboard grid of course cards (responsive: 1/2/3 columns)
- Video list modal showing videos in selected course
- Tailwind-styled components with smooth transitions

✅ **Task 3.4 & 3.5:** Token Generation & Video Player
- `useVideoToken` hook automatically requests and refreshes JWT tokens
- HLS.js video player with:
  - Adaptive bitrate streaming (auto-switches quality based on bandwidth)
  - Quality selector (720p, 480p, 360p, Auto)
  - Loading spinner and error handling
  - Mobile-friendly controls (touch support, fullscreen, rotation)
- Token refresh 15 minutes before expiry (seamless playback)

✅ **Task 3.6:** Dashboard Data Loading
- Queries `playlistAccess` collection to find user's courses
- Loads `playlists` and `videos` with Firestore
- Videos sorted by `position` field
- Loading skeletons and empty states
- Real-time updates (if using Firestore listeners)

## Development Workflow

### Running Locally

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Debugging

**Firebase Functions:** 
- Ensure `generateToken` Cloud Function is deployed
- Check function URL: `https://your-region-your_project_id.cloudfunctions.net/generateToken`
- Use browser DevTools → Network tab to inspect token requests

**Video Playback:**
- Check Cloudflare Worker logs in dashboard
- Verify `VITE_CLOUDFLARE_WORKER_URL` is correct
- Test token validation: request video without token should return 403

**Video List Not Loading:**
- Verify `playlistAccess` documents exist in Firestore
- Check Firestore security rules allow student to read their own `playlistAccess`
- Use Firestore Emulator for local testing: `firebase emulators:start`

## Security

### Token Flow
1. **User logs in** → Firebase creates session
2. **User clicks play** → `useVideoToken` requests JWT from `generateToken` Cloud Function
3. **Function validates** → Checks Firebase auth token, verifies user has access to video's playlist
4. **Function returns** → JWT token with 1-hour expiry
5. **Player makes request** → HLS.js requests manifest from Worker with token
6. **Worker validates** → Checks JWT signature, checks expiry, serves video from R2
7. **Token expires** → Hook automatically refreshes 15 minutes before expiry

### Protected Resources
- **R2 Bucket:** Private (no public read)
- **Video URLs:** Require valid JWT token
- **Firestore Queries:** Restricted by security rules (students can't read other student's data)
- **Cloud Functions:** Admin-only with role checks

## Deployment (Firebase Hosting)

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

**Pre-Deployment Checklist:**
- [ ] Set `VITE_FIREBASE_PROJECT_ID` in `.env.local`
- [ ] Run `npm run build` and test with `npm run preview`
- [ ] Verify `.env.local` is in `.gitignore` (don't commit secrets!)
- [ ] Test authentication flow on staging environment
- [ ] Test video playback on mobile devices
- [ ] Check Cloudflare Worker is deployed with correct JWT_SECRET

## Troubleshooting

### "CORS policy blocked" Error
**Cause:** R2 bucket CORS settings don't match your origin  
**Solution:** Check R2 CORS policy includes `https://your-domain` (not `http://`)

### "Access denied" Error (403)
**Cause:** User doesn't have access to video's playlist  
**Solution:** Verify `playlistAccess` document exists with correct `userId` and `playlistId`

### Video Won't Play
**Cause:** Token expired, invalid JWT_SECRET, or Worker offline  
**Solution:**
1. Check browser console for error message
2. Verify `VITE_CLOUDFLARE_WORKER_URL` is correct
3. Verify `generateToken` function deployed
4. Test Worker directly: `curl https://your-worker.workers.dev/invalid`

### "Cannot find module" Errors
**Cause:** Dependencies not installed  
**Solution:** Run `npm install` and remove `node_modules`, then reinstall

## Next Steps

### Phase 4: Testing & Launch
- [ ] Security audit (token validation, XSS prevention, CORS)
- [ ] Performance testing (video load time, concurrent users)
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] Production deployment & monitoring

### Phase 2 Enhancements (Future)
- [ ] Progress tracking (save playback position)
- [ ] Search & discovery (full-text search across videos)
- [ ] Comments & ratings
- [ ] Certificates & progress reports
- [ ] E-commerce integration

## Support

For issues with:
- **Firebase configuration:** See [Firebase documentation](https://firebase.google.com/docs)
- **Vite & React:** See [Vite docs](https://vitejs.dev) and [React docs](https://react.dev)
- **HLS.js:** See [HLS.js documentation](https://github.com/video-dev/hls.js)
- **Tailwind CSS:** See [Tailwind docs](https://tailwindcss.com/docs)

---

**Build Status:** ✅ Phase 4 Complete (Weeks 7-8)  
**Last Updated:** February 12, 2026
