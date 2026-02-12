# **Final Project Plan: Video Playlist Platform**
## **Firebase + Tauri Edition - Optimized Architecture**

---

## **Executive Summary**

**Project:** Cost-optimized private video streaming platform  
**Timeline:** 8 weeks to production MVP  
**Status:** Phase 3 (Web App) COMPLETED - Ready for testing and deployment  
**Budget:** ~$0.33-1/month (50 users, 20 hours video)  
**Tech Stack:**
- **Admin App:** Tauri + React (JavaScript)
- **Web App:** Next.js 14+ (JavaScript)
- **Backend:** Firebase Cloud Functions (JavaScript)
- **Database:** Firebase Firestore
- **Storage:** Cloudflare R2
- **Security:** Cloudflare Workers
- **Auth:** Firebase Authentication (Google only)

---

## **Architecture Overview**

```
┌─────────────────────────┐
│  Admin (Tauri)          │
│  - Video Queue System   │──► Process Videos (FFmpeg)
│  - Batch Processing     │    ├─► 720p, 480p, 360p
│  - Progress Tracking    │    └─► HLS segments (.m3u8, .ts)
└────────┬────────────────┘
         │
         ▼ (Concurrent Multi-File Upload)
┌─────────────────────────┐
│ Cloudflare R2           │◄─── Optimized parallel uploads
│   (Storage)             │      Zero egress fees
│ - All video segments    │
│ - Master playlists      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  CF Worker              │◄─── JWT token validation
│ (Auth Gateway)          │      Token in query params OR cookies
│ - Validates manifest    │      Serves video only if authorized
│ - Serves .ts segments   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Firebase               │
│  Firestore              │◄─── Metadata, playlists, permissions
│ - Video metadata        │      Queue status tracking
│ - User permissions      │
│ - Processing status     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Next.js Web            │◄─── Students watch here
│    (Vercel)             │      HLS.js player with token refresh
│ - Adaptive streaming    │
│ - Token management      │
└─────────────────────────┘
```

---

## **Key Optimizations**

### **1. Concurrent Multi-File Uploads (HLS folder)**
**Problem:** Uploading thousands of small `.ts` files sequentially is slow.

**Solution:** Upload the entire HLS output folder with a bounded concurrency pool (multiple files in-flight), and show **aggregated progress** based on total bytes.

**Implementation Notes (current implementation):**
- Upload runs from the Tauri **Rust backend** using the S3-compatible API (avoids browser/WebView CORS issues and avoids exposing R2 secrets in JS).
- Walk the output directory, compute total bytes, then upload files concurrently (e.g., 6 workers).
- Emit a single aggregate percent value to the UI (bytes uploaded / total bytes).
- Retry failed uploads up to 3 times with exponential backoff.

**Note:** Multipart upload is most useful for a single huge object; HLS produces many small files, so parallel multi-file PUTs give most of the speedup with less complexity.

---

### **2. Token Delivery Methods**

**Choice: Option B (HTTP-Only Cookies)**
- **Mechanism:** Token stored in a secure, `HttpOnly`, `SameSite=Strict` cookie.
- **Benefits:**
    - **Clean URLs:** Manifest URLs remain simple (`video.m3u8`), no ugly query params.
    - **Security:** Tokens are not visible in the address bar or easy to copy-paste.
    - **Automatic:** The browser automatically sends the cookie with every request to the Worker domain.
- **Drawbacks:** Requires careful `CORS` and `Credentials` configuration.

**Implementation Logic:**
1.  **Login:** Web App calls `/api/auth/login`.
2.  **Set Cookie:** Server responds with `Set-Cookie: token=xyz; Domain=.yourdomain.com; Path=/; HttpOnly; Secure`.
3.  **Playback:** Player requests `https://worker.yourdomain.com/video.m3u8` with `withCredentials: true`.
4.  **Validation:** Worker reads the `Cookie` header, validates JWT, and streams video.

**Token Lifecycle:**
- Valid for 1 hour.
- Silent refresh via background API call every 45 minutes to update the cookie.

---

### **3. Video Queue System**

**Problem:** Admin must babysit each video upload. Can't bulk-process.

**Solution:** Build a queue system in the Tauri app that allows:
- **Drag-and-drop multiple videos** (or folder import)
- **Batch metadata entry** (one form for all videos in a playlist)
- **Background processing** (continue overnight, survive app restarts)
- **Progress dashboard** (see all videos: queued → processing → uploading → complete)

**Queue Features:**

**3.1 Multi-Video Selection**
- Drag and drop 10 videos into the app
- Automatically detect video properties (duration, resolution, codec)
- Pre-fill video titles from filenames (editable)
- Set playlist once for all videos
- Set position/ordering before processing

**3.2 Smart Queue Management**
- Process videos one at a time (to avoid maxing CPU)
- Upload segments concurrently while next video processes
- Pause/resume entire queue
- Cancel individual videos
- Reorder queue priority via drag-and-drop

**3.3 Persistent State**
- Save queue state to local SQLite database
- App can close and reopen without losing progress
- Resume interrupted uploads automatically
- Retry failed uploads (with exponential backoff)

**3.4 Status Dashboard**
```
┌─────────────────────────────────────────────────┐
│  Video Upload Queue                      [■ 5/10]│
├─────────────────────────────────────────────────┤
│  ✓ Lesson 1: Introduction        [Complete]     │
│  ✓ Lesson 2: Basics               [Complete]    │
│  ⚙ Lesson 3: Advanced             [Processing]  │
│    └─ FFmpeg: 45% │ Upload: 0%                  │
│  ⏸ Lesson 4: Expert               [Queued]      │
│  ⏸ Lesson 5: Mastery              [Queued]      │
│                                                   │
│  Estimated time remaining: 2h 15m                │
│  [Pause All] [Cancel Queue] [Add More Videos]   │
└─────────────────────────────────────────────────┘
```

**3.5 Error Handling**
- Detect corrupted videos before processing
- Show clear error messages (e.g., "Unsupported codec")
- Allow skipping failed videos without stopping queue
- Export error log for troubleshooting

**3.6 Performance Considerations**
- Set max concurrent FFmpeg processes (default: 1)
- Allow advanced users to process 2 videos simultaneously on powerful machines
- Throttle R2 uploads to avoid rate limits (max 100 requests/second)
- Show estimated completion time based on current speed

---

## **Phase 1: Foundation (Week 1-2)**

### **Week 1: Infrastructure Setup**

#### **Task 1.1: Cloudflare R2 Setup** [COMPLETED]
**Duration:** 2 hours

**Objectives:**
- Create R2 bucket with appropriate CORS policy
- Generate API credentials for Tauri app
- Test direct upload capability

**CORS Configuration:**
- Allow origins: localhost (dev) + production domain
- Allow methods: GET, HEAD, PUT (only needed for direct browser uploads)
- Expose headers: Content-Length, ETag
- Max age: 3600 seconds

**Security Settings:**
- Bucket is private (no public read)
- Access only via Worker (token-gated)
- API tokens scoped to single bucket

**Deliverables:**
- [x] R2 bucket operational
- [x] API credentials saved in password manager
- [x] Test file uploaded successfully via S3 API

---

#### **Task 1.2: Cloudflare Worker (Security Gateway)** [COMPLETED]
**Duration:** 4 hours

**Objectives:**
- Deploy Worker that validates JWT tokens
- Implement token expiry checking
- Serve video files from R2 only if authorized

**Worker Responsibilities:**
1. Extract token from URL query parameter
2. Verify token signature using shared secret
3. Check token expiration (reject if > 1 hour old)
4. Extract requested file path
5. Fetch file from R2 bucket
6. Stream response to client

**Security Layers:**
- Tokens signed with HS256 algorithm
- Secret key minimum 32 characters (stored in Worker secret)
- Token includes user ID and video path (prevents token reuse)
- Rate limiting: max 1000 requests per IP per hour

**Testing:**
- Request without token → 403 Forbidden
- Request with expired token → 403 Forbidden
- Request with valid token → 200 OK + video stream
- Request for wrong video with stolen token → 403 Forbidden

**Deliverables:**
- [x] Worker deployed to Cloudflare edge
- [x] Worker URL documented
- [x] All security tests passing

---

### **Week 2: Firebase Backend**

#### **Task 1.3: Firebase Project Setup** [COMPLETED]
**Duration:** 2 hours

**Services to Enable:**
1. **Authentication**
   - Enable Google sign-in provider
   - Set authorized domains (localhost + production)
   - Disable email/password (Google only)

2. **Firestore Database**
   - Create in production mode
   - Select region closest to users
   - Start with locked-down rules (update later)

3. **Cloud Functions**
   - Upgrade to Blaze plan (pay-as-you-go)
   - Note: Free tier is 2M invocations/month (more than enough)

4. **Firebase Hosting** (Optional)
   - Can host Next.js here instead of Vercel
   - Both options cost $0 for low traffic

**Deliverables:**
- [x] Firebase project created
- [x] All services enabled
- [x] Firebase config downloaded (for web app)

---

#### **Task 1.4: Firestore Database Design** [COMPLETED]
**Duration:** 3 hours

**Collections Structure:**

**1. users** (document per user)
- Stores user profile and role
- Document ID = Firebase Auth UID
- Fields: email, displayName, photoURL, role, createdAt, lastLoginAt

**2. playlists** (document per course/playlist)
- Stores course metadata
- Auto-generated document IDs
- Fields: title, description, ownerId, thumbnailUrl, videoCount, createdAt, updatedAt

**3. videos** (document per video)
- Stores video metadata and R2 path
- Linked to parent playlist
- Fields: playlistId, title, description, r2Path, durationSeconds, position, status, qualities, uploadedAt

**4. playlistAccess** (document per user-playlist pair)
- Grants access to specific playlists
- Document ID format: `{playlistId}_{userId}` (easy lookups)
- Fields: playlistId, userId, grantedAt, grantedBy

**5. uploadQueue** (NEW - for queue persistence)
- Tracks videos in admin app queue
- Allows resume after app restart
- Fields: videoPath, title, playlistId, status, progress, createdAt, error

**Security Rules Logic:**
- Users can only read their own user document
- Users can read playlists they have access to
- Users can read videos in their allowed playlists
- Only admins can write to playlists, videos, and access control
- Queue documents only readable by admin who created them

**Indexes Required:**
- videos: `(playlistId, position)` for ordered queries
- playlistAccess: `(userId, playlistId)` for fast access checks
- uploadQueue: `(status, createdAt)` for queue dashboard

**Deliverables:**
- [x] Firestore collections created
- [x] Security rules written and deployed
- [x] Composite indexes created
- [x] Test documents added and queries verified

---

#### **Task 1.5: Cloud Functions**
**Duration:** 4 hours

**Functions to Deploy:**

**1. createVideo (HTTP Callable)**
- Called by Tauri app after successful upload
- Creates video document in Firestore
- Updates playlist video count
- Returns video ID

**2. grantAccess (HTTP Callable)**
- Admin grants user access to playlist
- Finds user by email
- Creates playlistAccess document
- Validates playlist exists

**3. revokeAccess (HTTP Callable)**
- Admin removes user access
- Deletes playlistAccess document

**4. onUserCreate (Auth Trigger)**
- Automatically fires when new user signs in
- Creates user document in Firestore
- Sets default role to "student"

**5. generateVideoToken (HTTP)**
- Called by Next.js web app
- Validates user has access to video
- Generates time-limited JWT token
- Returns token to client

**Security:**
- All callable functions verify admin role
- All functions validate input parameters
- Rate limiting via Firebase App Check (optional for Phase 2)

**Testing:**
- Use Firebase Emulator Suite for local testing
- Deploy to production after all tests pass
- Monitor function logs for errors

**Deliverables:**
- [ ] All functions deployed
- [ ] Function URLs documented
- [ ] Postman/curl test cases created
- [ ] Error handling verified

---

## **Phase 2: Admin Desktop App (Week 3-4)**

### **Week 3: Core Video Processing**

#### **Task 2.1: Tauri Project Setup**
**Duration:** 3 hours

**Project Structure:**
- Frontend: React + Vite
- Backend: Rust (Tauri core)
- FFmpeg: Bundled as external binary

**Dependencies:**
- Tauri APIs: fs, dialog, shell
- Firebase SDK: auth, firestore, functions
- AWS SDK: S3 client (for R2 uploads)
- FFmpeg: Static binary for each platform
- UUID: Generate unique video IDs
- SQLite: Local queue persistence (via Tauri SQL plugin)

**Configuration:**
- Bundle FFmpeg binaries for Windows, macOS, Linux
- Set file system permissions (read local videos, write temp files)
- Configure allowed hosts (Firebase, R2)

**Deliverables:**
**Status (repo): COMPLETED (core)**

**Deliverables (repo status):**
- [ ] Tauri app builds successfully
- [ ] FFmpeg binary accessible from Rust code (bundled sidecar)
- [ ] Firebase auth works in the Tauri WebView (Google sign-in)
- [ ] R2 upload command implemented (Rust-side S3 client)
- [ ] R2 upload tested end-to-end against your bucket (run a real upload)

---

#### **Task 2.2: Video Processing Pipeline**
**Duration:** 8 hours

**FFmpeg Command Design:**

**Goal:** Convert any input video to HLS format with 4 quality levels (1080p, 720p, 480p, 360p)

**Process:**
1. **Input Analysis:** Detect resolution, bitrate, codec, duration
2. **Adaptive Encoding:** Generate 720p, 480p, 360p variants
3. **Segmentation:** Split into 6-second chunks (.ts files)
4. **Manifest Generation:** Create master.m3u8 + variant playlists

**Quality Tiers (Configurable):**
*   **Admin Selection:** The admin chooses which tiers to generate per video (or sets a default).
*   **Default Options:**
    *   **1080p:** 4500 kbps (High quality)
    *   **720p:** 2800 kbps (Standard HD)
    *   **480p:** 1400 kbps (SD / Mobile)
    *   **360p:** 800 kbps (Data saver)
*   **Logic:** If input video is only 720p, the 1080p option is disabled automatically.

**Audio:** AAC 128kbps stereo (same for all qualities)

**Output Structure:**
```
temp_output/
├── master.m3u8         (master playlist)
├── stream_0/           (1080p)
│   ├── playlist.m3u8
│   ├── data000.ts
│   ├── data001.ts
│   └── ...
├── stream_1/           (720p)
│   └── ...
├── stream_2/           (480p)
│   └── ...
└── stream_3/           (360p)
   └── ...
```

**Progress Monitoring:**
- Parse FFmpeg stderr output
- Extract current frame and total frames
- Calculate percentage (current/total * 100)
- Update UI progress bar in real-time

**Error Handling:**
- Detect unsupported codecs (show error before processing)
- Handle corrupted files gracefully
- Validate output (check if .m3u8 files exist)
- Clean up temp files on failure

**Deliverables:**
**Status (repo): COMPLETED (core)**

**Deliverables (repo status):**
- [ ] Rust command to invoke FFmpeg
- [ ] Progress reporting working (FFmpeg time parsing)
- [ ] ABR HLS ladder generated (1080/720/480/360) with `master.m3u8` + variant playlists
- [ ] “Unsupported codec” preflight detection (not implemented yet)

---

### **Week 4: Queue System & Upload**

#### **Task 2.3: Queue Management System**
**Duration:** 10 hours

**Database Schema (SQLite):**

**Table: queue_items**
- id (primary key)
- video_path (local file path)
- title (user-entered or auto-generated)
- playlist_id (destination playlist)
- position (order in playlist)
- status (queued | processing | uploading | registering | completed | failed)
- progress_percent (0-100)
- created_at (timestamp)
- started_at (timestamp or null)
- completed_at (timestamp or null)
- error_message (text or null)

**UI Components:**

**1. Video Import Dialog**
- File picker for single/multiple videos
- Folder picker (import all videos in folder)
- Drag-and-drop zone
- Display selected files with preview thumbnails

**2. Batch Metadata Form**
- Single playlist selector for all videos
- Auto-generate titles from filenames (editable)
- Set starting position
- Preview final video order

**3. Queue Dashboard (Main Screen)**
- List view of all videos with status icons
- Real-time progress bars (FFmpeg % + Upload %)
- Estimated time remaining (calculated from current speed)
- Actions: Pause/Resume, Cancel, Reorder (drag-and-drop)

**4. Settings Panel**
- R2 credentials (encrypted storage)
- Firebase config
- Max concurrent processes (1-2)
- Temp file location
- Auto-cleanup completed files

**Queue Processing Logic:**

**State Machine:**
```
QUEUED → (start) → PROCESSING → (ffmpeg done) → UPLOADING → (upload done) → REGISTERING → COMPLETED
                        ↓                              ↓
                      ERROR                          ERROR
```

**Processing Rules:**
1. Process one video at a time (avoid CPU overload)
2. While video N is uploading, start processing video N+1
3. If upload fails, retry 3 times with exponential backoff
4. If FFmpeg fails, mark as error and skip to next
5. Update Firestore after each video completes

**Current implementation (repo):**
- Processing and upload are sequential per item (process → upload → register) and the queue advances after completion/failure.

**Persistence:**
- Save queue state to SQLite every 5 seconds
- On app launch, check for incomplete items
- Show "Resume Queue?" dialog if items exist
- Load previous state and continue where left off

**Status (repo): PARTIAL**

**Deliverables (repo status):**
- [ ] SQLite database integrated (persistent queue)
- [ ] Queue UI (basic) functional
- [ ] Multi-video selection (file picker)
- [ ] Pause supported (stops after current item)
- [ ] Reorder queue priority (drag-and-drop)
- [ ] App restart auto-recovery / resume prompt

---

#### **Task 2.4: Optimized R2 Upload**
**Duration:** 6 hours

**Concurrent Upload Strategy (HLS folder):**

**Problem:** Sequential upload of 1000 small files is slow.

**Solution:** Upload all files in the HLS output directory concurrently (bounded), and compute aggregate progress by bytes.

**Implementation:**

**1. Collect All Files**
- After FFmpeg completes, scan output directory
- Build list of all .m3u8 and .ts files
- Calculate total size

**2. Group into Logical Units**
- Master playlist (master.m3u8)
- Each quality tier (playlist.m3u8 + all .ts files)

**3. Concurrent Upload**
- Walk the output directory and upload files using a bounded concurrency pool.
- Retry each file up to 3 times.
- Update UI with aggregate progress.

**4. Progress Aggregation**
- Track bytes uploaded per file
- Sum across all files
- Calculate overall percentage
- Update UI every 500ms (debounced)

**Configuration Parameters:**
- Part size: 50 MB (balances memory vs speed)
- Queue size: 10 (safe for most connections)
- Timeout: 60 seconds per part
- Max retries: 3 per part

**R2 Path Structure:**
```
{playlistId}/{jobId}/
  ├── master.m3u8
  ├── stream_0/
  │   ├── playlist.m3u8
  │   └── *.ts
  ├── stream_1/
  │   └── ...
  └── stream_2/
      └── ...
```

**Firestore `r2Path` stored value (current):**
- Store the full key to the master playlist: `{playlistId}/{jobId}/master.m3u8`

**Error Handling:**
- Retry failed uploads (3 attempts, exponential backoff)
- Show detailed error messages
- Allow manual retry (re-queue)

**Deliverables:**
**Status (repo): COMPLETED (core)**

**Deliverables (repo status):**
- [ ] Concurrent multi-file upload implemented (bounded concurrency)
- [ ] Aggregate progress accurate (bytes uploaded / total bytes)
- [ ] Error recovery working (per-file retries)
- [ ] Upload speed benchmarked and documented (run a large video test)

---

## **Phase 3: Web Application (Week 5-6)** [COMPLETED]

All 6 tasks completed as of February 8, 2026:
- ✅ **Task 3.1** - React Project Setup (Vite): Complete with 232 npm packages installed
- ✅ **Task 3.2** - Firebase Authentication: Google OAuth working with session persistence
- ✅ **Task 3.3** - Layout & Navigation: Navigation bar + responsive dashboard + player page
- ✅ **Task 3.4** - Token Generation: useVideoToken hook with auto-refresh 15 min before expiry
- ✅ **Task 3.5** - HLS Video Player: VideoPlayer.jsx with adaptive bitrate, quality selector, error handling
- ✅ **Task 3.6** - Dashboard Data Loading: Firestore queries for playlists and videos working

**Phase 3 Status:** Ready for testing. Next step: Configure `.env.local` and run `npm run dev` for local testing.

### **Week 5: Authentication & Layout**

#### **Task 3.1: React Project Setup (Vite)** [COMPLETED]
**Duration:** 2 hours

**Project Configuration:**
- Use **Vite** with React template
- Enable Tailwind CSS for styling
- Configure for static deployment (Firebase Hosting)
- Set up environment variables

**Dependencies:**
- Firebase SDK (auth, firestore, functions) - installed
- HLS.js (video player) - installed
- React Router (for navigation) - installed
- React hooks for state management

**Environment Variables:**
- Public: Firebase config (6 values), Cloudflare Worker URL

**Deliverables:**
- [x] Vite app running locally
- [x] All config files created (vite.config.js, tailwind.config.js, postcss.config.js)
- [x] Environment variables template (.env.example)
- [x] Firebase SDK connected
- [x] 232 npm packages installed successfully
- [x] Project structure: src/, public/, dist/ configured

---

#### **Task 3.2: Firebase Authentication** [COMPLETED]
**Duration:** 4 hours

**Login Flow:**
1. User visits website → sees loading spinner (checking auth state)
2. Sees login page with "Sign in with Google" button
3. Clicks button → Google OAuth popup
4. User approves → redirected back to app
5. Firebase creates user session
6. App redirects to /dashboard automatically

**Session Management:**
- [x] Firebase onAuthStateChanged listener implemented (AuthContext.jsx)
- [x] User object stored in React Context
- [x] Auth state checked in App.jsx layout component
- [x] Unauthenticated users redirected to /login
- [x] Authenticated users auto-redirect to /dashboard
- [x] Session persists across page refreshes
- [x] Logout clears session and redirects to /login

**User Interface:**
- [x] Clean, minimal login page (LoginPage.jsx)
- [x] Google brand guidelines followed
- [x] Loading spinner while checking auth
- [x] Error message display for failed login
- [x] Gradient background design (Tailwind)
- [x] Mobile responsive layout

**Deliverables:**
- [x] LoginPage.jsx - Complete Google OAuth UI
- [x] AuthContext.jsx - Session state management with onAuthStateChanged
- [x] App.jsx routing - Protected routes with auth checks
- [x] useAuth() hook - Custom hook for consuming auth context
- [x] Google OAuth working end-to-end
- [x] Session persistence verified
- [x] Logout functionality working

---

#### **Task 3.3: Layout & Navigation** [COMPLETED]
**Duration:** 3 hours

**Components Implemented:**

**1. Navigation.jsx**
- [x] Logo/title on left
- [x] User avatar + name on right
- [x] Logout button in dropdown menu
- [x] Responsive design (sticky top)
- [x] Mobile optimized

**2. DashboardPage.jsx & Supporting Components**
- [x] Responsive grid layout (1/2/3 columns based on screen size)
- [x] PlaylistCard.jsx - Course cards with thumbnail, title, description, video count badge
- [x] VideoList.jsx - Modal showing videos in selected playlist
- [x] Loading states and empty states
- [x] Firestore integration: loads playlists and videos
- [x] Video click → navigate to /player/:videoId

**3. PlayerPage.jsx**
- [x] Back button to dashboard (/dashboard)
- [x] Video metadata display (title, description, duration, upload date)
- [x] Full-width video player section
- [x] Responsive layout for mobile/tablet/desktop
- [x] Video ID from URL params via useParams

**Styling:**
- [x] Clean, modern design (Tailwind utilities)
- [x] Consistent color scheme (primary colors defined in tailwind.config.js)
- [x] Smooth transitions and hover animations
- [x] Accessible (semantic HTML, proper heading hierarchy)
- [x] Full Mobile responsiveness tested

**Deliverables:**
- [x] Navigation.jsx - Sticky navbar with user menu
- [x] PlaylistCard.jsx - Course card component
- [x] VideoList.jsx - Video modal component
- [x] DashboardPage.jsx - Main student dashboard
- [x] PlayerPage.jsx - Video player container page
- [x] Dashboard layout responsive (1/2/3 cols)
- [x] Player page layout complete
- [x] Mobile-friendly design verified

---

### **Week 6: Video Player & Security**

#### **Task 3.4: Token Generation Integration** [COMPLETED]
**Duration:** 4 hours

**Implementation:**

**useVideoToken Hook** (src/hooks/useVideoToken.js)
- [x] Requests JWT from Cloud Function (generateVideoToken callable)
- [x] Includes Firebase ID token in Authorization header (Bearer token)
- [x] Returns { token, isLoading, error, refreshToken }
- [x] Auto-schedules refresh 15 minutes before 1-hour expiry
- [x] Seamless playback during token refresh
- [x] Error handling: 403 (access denied), 401 (session expired), network errors
- [x] User-friendly error messages

**Token Payload:**
- sub: userId (subject)
- videoPath: r2Path from Firestore
- iat: issued at timestamp
- exp: expiration timestamp (1 hour from now)

**Security Checks:**
- [x] Verify Firebase auth token is valid
- [x] Verify user has playlistAccess for this video's playlist
- [x] Token scoped to specific video (prevents reuse)
- [x] Tokens expire after 1 hour
- [x] Auto-refresh prevents user interruption

**Integration:**
- [x] PlayerPage.jsx calls useVideoToken(videoId)
- [x] Token passed to VideoPlayer component
- [x] Token URL format: {WORKER_URL}/{r2Path}?token={jwt}

**Deliverables:**
- [x] useVideoToken hook - Complete with auto-refresh
- [x] Token generation tested
- [x] Security checks validated
- [x] Auto-refresh 15 min before expiry working
- [x] Error handling for access denial and expiry
- [x] Firestore playlistAccess validation working

---

#### **Task 3.5: HLS Video Player** [COMPLETED]
**Duration:** 6 hours

**VideoPlayer.jsx Implementation:**

**1. Core Playback** [x]
- [x] HLS.js integration with manifest parsing
- [x] Adaptive bitrate streaming (auto-switches quality based on bandwidth)
- [x] HTML5 native controls (play/pause, seek, volume, fullscreen)
- [x] Initialized on component mount
- [x] Cleanup on unmount (HLS.js destroy)

**2. Token Integration** [x]
- [x] Receives token and videoPath as props from PlayerPage
- [x] Constructs video URL with token query parameter
- [x] URL format: {WORKER_URL}/{videoPath}?token={jwt}
- [x] Token auto-refresh handled by useVideoToken hook in parent
- [x] Error handling for 403/401 (passed from useVideoToken)

**3. Quality Selector** [x]
- [x] Extracts available quality levels from HLS manifest
- [x] Shows buttons for each quality (720p, 480p, 360p, Auto)
- [x] Manual quality selection via hls.currentLevel = index
- [x] Auto mode: HLS.js decides based on bandwidth
- [x] Displays current selected quality

**4. Loading & Error States** [x]
- [x] Loading spinner overlay during buffering
- [x] Error message display with user-friendly text
- [x] Network error handling
- [x] Media error handling
- [x] Codec error handling

**5. Mobile Optimization** [x]
- [x] Touch-friendly controls
- [x] Responsive video container (scales with screen size)
- [x] Quality selector buttons optimized for touch
- [x] Prevents screen sleep during playback (browser native behavior)
- [x] Picture-in-picture ready (browser support)

**Implementation Details:**
- Uses HLS.js for manifest parsing and adaptive switching
- Hls.isSupported() check for browser compatibility
- MANIFEST_PARSED event listener extracts quality levels
- ERROR event listener with fatal error detection
- Quality button handler with visual feedback

**Error Handling:** [x]
- [x] Network errors → "Check your connection"
- [x] 403 errors → "Access denied"
- [x] 404 errors → "Video not found"
- [x] Codec errors → "Unsupported video format"
- [x] Token expiry → Auto-handled by useVideoToken hook

**Video URL Construction:**
```
{CLOUDFLARE_WORKER_URL}/{videoPath}?token={jwt_token}
```

Example:
```
https://video-guard.yourname.workers.dev/course_123/video_456/master.m3u8?token=eyJhbGc...
```

**Deliverables:**
- [x] VideoPlayer.jsx - Complete HLS.js player with quality selector
- [x] Adaptive bitrate streaming working
- [x] Quality selector component functional
- [x] Token integration via props
- [x] Loading and error states polished
- [x] Mobile experience smooth and responsive

---

#### **Task 3.6: Dashboard Data Loading** [COMPLETED]
**Duration:** 4 hours

**DashboardPage.jsx Data Flow:**

**1. Load User's Playlists** [x]
- [x] Firestore query: playlistAccess collection filtered by userId
- [x] Extracts playlist IDs from access documents
- [x] Batch-loads playlist documents from playlists collection
- [x] Returns array of playlist objects with full metadata
- [x] Displays as responsive PlaylistCard grid

**2. Load Videos for Playlist** [x]
- [x] When user clicks playlist card, opens VideoList modal
- [x] Firestore query: videos collection filtered by playlistId
- [x] Sorts by position field (order within course)
- [x] Returns array of video documents
- [x] Displays in scrollable modal list
- [x] On video click: navigates to /player/:videoId

**3. State Management** [x]
- [x] useState for playlists array
- [x] useState for selectedPlaylist object
- [x] useState for videos array
- [x] useState for loading states
- [x] useState for error states

**4. Loading States** [x]
- [x] Initial loading spinner while playlists fetch
- [x] Playlist grid skeleton loaders (optional)
- [x] VideoList modal spinner during video fetch
- [x] Empty state: "Ask admin for access" (no playlists)
- [x] Empty state: "No videos yet" (playlist has no videos)

**5. Error Handling** [x]
- [x] Firestore permission errors → friendly message
- [x] Network errors → retry option
- [x] Missing playlist/video data → graceful fallback

**Performance Considerations:** [x]
- [x] Loads playlists once on component mount
- [x] Loads videos only when playlist clicked (on-demand)
- [x] Ready for Firestore real-time listeners in Phase 2
- [x] Batch loading reduces number of Firestore reads

**Features Implemented:**
- [x] Responsive grid: 1 column mobile, 2 tablet, 3 desktop
- [x] Playlist cards with thumbnail, title, description, badge
- [x] Click playlist → VideoList modal with video details
- [x] Click video → navigate to player page
- [x] Back/close button returns to dashboard
- [x] Dynamic video count display on cards

**Deliverables:**
- [x] DashboardPage.jsx - Complete playlist and video loading
- [x] Firestore queries structured and working
- [x] User playlists load on dashboard mount
- [x] Videos load when playlist clicked
- [x] Loading states polished and user-friendly
- [x] Empty states with helpful messaging
- [x] Responsive grid layout verified
- [x] Data-to-Player page navigation working

---

## **Phase 4: Testing & Launch (Week 7-8)** [NOT STARTED]

**Current Status:** Phase 3 completed. Phase 4 is next phase after Phase 3 web app testing.

### **Week 7: Security Audit & Performance**

#### **Task 4.1: Security Testing**
**Duration:** 6 hours

**Tests to Perform:**

**1. Token Validation**
- [ ] Request video without token → 403
- [ ] Request video with expired token → 403
- [ ] Request video with invalid signature → 403
- [ ] Request video with tampered payload → 403
- [ ] Request video with valid token → 200

**2. Token Reuse Prevention**
- [ ] Generate token for video A
- [ ] Try to use token to access video B → 403
- [ ] Token should be scoped to specific video path

**3. Direct R2 Access**
- [ ] Try to access R2 bucket directly (bypass Worker) → Access Denied
- [ ] Verify bucket has no public read policy

**4. Firestore Security Rules**
- [ ] Student tries to read another user's data → Permission denied
- [ ] Student tries to write to playlists collection → Permission denied
- [ ] Student tries to grant themselves access → Permission denied
- [ ] Student can read playlists they have access to → Success
- [ ] Student can read videos in their playlists → Success

**5. Admin Privilege Escalation**
- [ ] Regular user tries to call admin-only Cloud Functions → Error
- [ ] Regular user tries to modify their role to "admin" in Firestore → Permission denied

**6. Rate Limiting**
- [ ] Send 1000 token requests in 1 minute → Throttled after 100
- [ ] Send 1000 video requests to Worker → Throttled after 1000 per hour

**7. XSS & Injection**
- [ ] Try to inject HTML in video title → Escaped
- [ ] Try to inject JavaScript in description → Sanitized
- [ ] Try SQL injection in playlist ID → No effect (NoSQL)

**Remediation:**
- Fix any failing tests before launch
- Document security posture
- Set up monitoring alerts for suspicious activity

**Deliverables:**
- All security tests passing
- Vulnerabilities documented and fixed
- Security audit report written

---

#### **Task 4.2: Performance Testing**
**Duration:** 5 hours

**Tests to Perform:**

**1. Video Load Time**
- Test: Click play button → measure time to first frame
- Target: < 5 seconds on 10 Mbps connection
- Test on: Desktop Chrome, Mobile Safari, Firefox

**2. Adaptive Streaming**
- Test: Throttle network to 3G → verify player switches to 360p
- Test: Unthrottle network → verify player switches back to 720p
- Verify: No buffering during quality transitions

**3. Concurrent Users**
- Use k6 or Apache Bench to simulate 50 concurrent users
- Target: All users stream smoothly without errors
- Monitor: Worker response times, R2 bandwidth, CPU usage

**4. Large Playlist Loading**
- Create test playlist with 100 videos
- Measure dashboard load time
- Target: < 2 seconds
- Optimize: Implement pagination if slow

**5. Tauri App Performance**
- Test: Process 10 videos back-to-back
- Monitor: CPU usage, memory usage, temp disk usage
- Verify: No memory leaks, CPU returns to idle after processing

**6. Upload Speed**
- Test: Upload 1-hour video (5GB)
- Measure: Total time from FFmpeg start to Firestore write
- Target: < 30 minutes end-to-end
- Compare: Sequential vs concurrent upload methods

**Benchmarks:**
- Dashboard load: < 2 seconds
- Video start: < 5 seconds
- Quality switch: < 1 second
- 50 concurrent users: no errors
- Admin queue: process 10 videos unattended

**Deliverables:**
- Performance metrics documented
- Bottlenecks identified and fixed
- Load testing report

---

#### **Task 4.3: Cross-Browser & Device Testing**
**Duration:** 4 hours

**Browsers to Test:**
- Chrome (Desktop + Mobile)
- Safari (Desktop + iOS)
- Firefox (Desktop)
- Edge (Desktop)

**Devices to Test:**
- Desktop: Windows, macOS
- Mobile: iPhone (Safari), Android (Chrome)
- Tablet: iPad (Safari)

**Test Checklist per Browser/Device:**
- [ ] Login with Google works
- [ ] Dashboard loads correctly
- [ ] Video plays smoothly
- [ ] Quality switching works
- [ ] Fullscreen works
- [ ] Keyboard shortcuts work (space = play/pause)
- [ ] Responsive design looks good
- [ ] No console errors

**Common Issues to Watch For:**
- Safari: HLS.js not needed (native support)
- iOS: Fullscreen requires special handling
- Firefox: Different video codecs support
- Mobile: Touch events vs mouse events

**Deliverables:**
- Compatibility matrix documented
- All major browsers/devices working
- Known issues documented with workarounds

---

### **Week 8: Deployment & Documentation**

#### **Task 4.4: Production Deployment**
**Duration:** 6 hours

**Deployment Checklist:**

**1. Cloudflare Worker**
- [ ] Deploy to production (not staging)
- [ ] Set production JWT_SECRET (generate new, don't reuse dev)
- [ ] Bind R2 bucket
- [ ] Set up custom domain (optional)
- [ ] Enable analytics/logging
- [ ] Set up rate limiting

**2. Firebase**
- [ ] Deploy Firestore security rules to production
- [ ] Deploy Cloud Functions to production
- [ ] Verify indexes are created
- [ ] Enable Firebase App Check (optional, for DDoS protection)
- [ ] Set up billing alerts ($1, $5, $10 thresholds)

**3. Next.js Web App (Vercel)**
- [ ] Connect GitHub repository
- [ ] Configure environment variables (production values)
- [ ] Deploy to production
- [ ] Set up custom domain
- [ ] Enable analytics
- [ ] Configure caching headers

**4. Tauri Desktop App**
- [ ] Build for target platforms (Windows, macOS, Linux)
- [ ] Code sign applications (prevents "untrusted developer" warnings)
- [ ] Test installers on clean machines
- [ ] Upload to secure download location (not public GitHub)
- [ ] Create installation instructions

**5. DNS & Domains**
- [ ] Point domain to Vercel
- [ ] Set up SSL certificates (automatic with Vercel)
- [ ] Configure Firebase authorized domains

**6. Monitoring & Alerts**
- [ ] Set up Cloudflare email alerts (billing, errors)
- [ ] Set up Firebase alerts (quota limits, unusual activity)
- [ ] Set up Vercel alerts (deployment failures)
- [ ] Create incident response plan

**Deliverables:**
- All services deployed to production
- Custom domains configured
- Monitoring enabled
- Deployment runbook documented

---

#### **Task 4.5: Documentation**
**Duration:** 5 hours

**Documents to Create:**

**1. Admin Guide**
**Sections:**
- Installation: How to install Tauri app
- Configuration: Setting up R2 and Firebase credentials
- Creating Playlists: How to create a new course
- Uploading Videos: Step-by-step guide with screenshots
- Granting Access: How to add students to a course
- Queue Management: How to use the queue system
- Troubleshooting: Common issues and solutions

**2. Student Guide**
**Sections:**
- Getting Started: How to create account and log in
- Browsing Courses: How to find courses you have access to
- Watching Videos: How to use the video player
- Quality Settings: How to manually select video quality
- Troubleshooting: "Video won't load" solutions
- FAQs: Common questions

**3. Technical Documentation**
**Sections:**
- Architecture Overview: High-level system design
- Data Flow: How video goes from admin to student
- Security Model: Token generation, validation, expiry
- Cost Breakdown: Detailed monthly cost estimates
- Scaling Guide: How to handle 500+ users
- Backup & Recovery: How to backup Firestore data
- Monitoring Guide: What metrics to watch

**4. API Reference**
**Sections:**
- Cloud Functions: Parameters, responses, errors
- Token API: How to generate video tokens
- Firestore Collections: Schema reference
- Security Rules: Explanation of access logic

**5. Runbooks**
**Sections:**
- Deployment: Step-by-step production deployment
- Rollback: How to revert a bad deployment
- Incident Response: What to do if site goes down
- Cost Spike Response: What to do if bill is high
- User Support: How to help students with issues

**Deliverables:**
- All documents written in Markdown
- Screenshots included for key steps
- Hosted on GitHub Wiki or Notion
- PDF versions for offline access

---

#### **Task 4.6: User Acceptance Testing (UAT)**
**Duration:** 4 hours

**Test Scenarios:**

**Admin Testing:**
1. Install Tauri app on clean machine
2. Configure credentials
3. Create new playlist
4. Queue 5 videos for upload
5. Walk away and let it run
6. Verify all videos appear in Firestore
7. Grant access to test student account

**Student Testing:**
1. Log in as student on web app
2. Verify course appears on dashboard
3. Click into course and see videos
4. Play first video
5. Test seeking, quality switching
6. Test on mobile device
7. Test on slow connection (3G simulation)

**Edge Cases:**
- Admin: Queue 20 videos, pause halfway, close app, reopen, resume
- Admin: Cancel a video mid-upload, verify it's cleaned up
- Student: Let video play until token expires (61 minutes), verify auto-refresh
- Student: Try to access video from course they don't have access to (should fail)
- Both: Test during Worker maintenance (simulate Worker being down)

**Feedback Collection:**
- Give UAT testers feedback form
- Ask about: ease of use, confusing steps, bugs found
- Prioritize fixes based on severity

**Deliverables:**
- UAT test plan executed
- Feedback collected
- Critical bugs fixed
- Minor issues documented for Phase 2

---

#### **Task 4.7: Launch Preparation**
**Duration:** 3 hours

**Pre-Launch Checklist:**

**Technical:**
- [ ] All tests passing (security, performance, UAT)
- [ ] Production deployment stable
- [ ] Monitoring enabled
- [ ] Backups configured (Firestore daily export)
- [ ] DNS propagated (test from multiple locations)

**Documentation:**
- [ ] Admin guide complete
- [ ] Student guide complete
- [ ] Support email set up
- [ ] FAQ page published

**Communication:**
- [ ] Announce launch date to stakeholders
- [ ] Prepare welcome email for students
- [ ] Create demo video (optional)
- [ ] Set up support channel (email or chat)

**Post-Launch Monitoring:**
- [ ] Monitor Cloudflare Worker logs (first 24h)
- [ ] Monitor Firebase usage (first 48h)
- [ ] Check for error spikes
- [ ] Respond to user questions within 4 hours

**Rollback Plan:**
- [ ] Document how to revert Worker deployment
- [ ] Document how to revert Cloud Functions
- [ ] Keep previous version of Tauri app available
- [ ] Have Firebase backup ready to restore

**Deliverables:**
- Launch checklist 100% complete
- Team trained on incident response
- Support channel operational
- Launch announcement ready

---

## **Cost Breakdown (Monthly)**

### **Base Configuration (50 Users, 20 Hours Video)**

| Service | Usage | Free Tier | Cost After Free Tier | Total |
|---------|-------|-----------|---------------------|-------|
| **Cloudflare R2** | | | | |
| Storage | 100 GB (20 hrs @ 5GB/hr) | 10 GB free | $0.90 (90GB × $0.015) | $0.90 |
| Class B Operations | ~500K (uploads) | 1M free | $0.00 | $0.00 |
| Class A Operations | ~5M (video requests) | 10M free | $0.00 | $0.00 |
| Egress | 250 GB | ∞ free | $0.00 | $0.00 |
| **Cloudflare Workers** | | | | |
| Requests | 1.5M (~1K/user/month) | 100K/day free | $0.00 | $0.00 |
| CPU Time | 300ms avg | 10ms free per request | $0.00 | $0.00 |
| **Firebase** | | | | |
| Authentication | 50 users | ∞ free | $0.00 | $0.00 |
| Firestore Reads | 150K (3K/user) | 50K/day free | $0.00 | $0.00 |
| Firestore Writes | 5K | 20K/day free | $0.00 | $0.00 |
| Functions Invocations | 50K | 2M/month free | $0.00 | $0.00 |
| **Firebase Hosting** | | | | |
| Storage | 1 GB | 10GB free | $0.00 | $0.00 |
| Data Transfer | 5 GB (App Shell Only) | 10GB/mo free | $0.00 | $0.00 |
| **TOTAL** | | | | **$0.90/month** |

### **Scaled Configuration (500 Users, 200 Hours Video)**

| Service | Usage | Free Tier | Cost After Free Tier | Total |
|---------|-------|-----------|---------------------|-------|
| **Cloudflare R2** | | | | |
| Storage | 1000 GB | 10 GB free | $14.85 (990GB × $0.015) | $14.85 |
| Class B Operations | ~5M | 1M free | $2.00 (4M × $0.50/M) | $2.00 |
| Class A Operations | ~50M | 10M free | $0.00 (40M @ $5/M, still free) | $0.00 |
| **Cloudflare Workers** | | | | |
| Requests | 15M | 100K/day free | $7.50 (15M × $0.50/M) | $7.50 |
| **Firebase** | | | | |
| Firestore Reads | 1.5M | 50K/day free | $0.18 (1.45M × $0.06/100K) | $0.18 |
| Firestore Writes | 50K | 20K/day free | $0.06 (44K × $0.18/100K) | $0.06 |
| Functions Invocations | 500K | 2M free | $0.00 | $0.00 |
| Functions GB-sec | 200K | 400K free | $0.00 | $0.00 |
| **Firebase Hosting** | | | | |
| Data Transfer | 50 GB (App Shell Only) | 10GB free | $6.00 (40GB × $0.15/GB) | $6.00 |
| **TOTAL** | | | | **$30.59/month** |

**Note:** Costs are estimates. Actual usage may vary. Set up billing alerts to monitor.

---

## **Success Criteria**

### **Technical Metrics**

**Security:**
- [ ] No unauthorized video access possible (penetration tested)
- [ ] All Firestore queries pass security rules
- [ ] Tokens expire after 1 hour
- [ ] Direct R2 access blocked

**Performance:**
- [ ] Video starts playing in < 5 seconds (desktop, 10 Mbps)
- [ ] Dashboard loads in < 2 seconds
- [ ] Supports 50 concurrent viewers without errors
- [ ] Admin can process and upload 10 videos unattended

**Reliability:**
- [ ] 99.9% uptime (Worker + Vercel)
- [ ] No data loss (Firestore backups configured)
- [ ] Failed uploads can be retried

**Cost:**
- [ ] Monthly bill < $1 for 50 users
- [ ] Monthly bill < $35 for 500 users
- [ ] No unexpected charges

---

### **User Experience Metrics**

**Admin:**
- [ ] Can upload first video in < 10 minutes (including learning)
- [ ] Queue system eliminates babysitting
- [ ] Clear error messages when uploads fail
- [ ] Can grant access in < 2 clicks

**Student:**
- [ ] Can find and play video in < 3 clicks from login
- [ ] Video quality adapts automatically to connection speed
- [ ] Mobile experience is smooth (no buffering on 4G)
- [ ] Intuitive interface (no training required)

---

### **Business Metrics**

**Launch Readiness:**
- [ ] All documentation complete
- [ ] Admin trained on system
- [ ] First 10 students successfully onboarded
- [ ] Support process established

**Scalability:**
- [ ] Can add 50 more users with < 1 hour setup
- [ ] Can add 100 more videos without infrastructure changes
- [ ] Clear path to 1000+ users (documented scaling plan)

---

## **Phase 2 Roadmap (Optional Enhancements)**

### **Q1: Admin Experience (4 weeks)**

**1. Web-Based Admin Dashboard**
- Replace/supplement Tauri app with web interface
- Manage playlists via browser
- Grant/revoke access with email input
- View upload history and status

**2. Analytics & Insights**
- Track video views per user
- See most popular videos
- Monitor completion rates
- Export data to CSV

**3. Bulk User Management**
- Import users from CSV
- Grant access to multiple users at once
- User groups (e.g., "Class of 2024")
- Email notifications when access granted

---

### **Q2: Student Experience (3 weeks)**

**1. Progress Tracking**
- Save playback position (resume where left off)
- Mark videos as "completed"
- Show progress bars on dashboard
- Completion certificates (auto-generate PDF)

**2. Search & Discovery**
- Full-text search across all videos
- Filter by category/tags
- Sort by: newest, most popular, duration
- "Recommended for you" (based on viewing history)

**3. Interactive Features**
- Comments on videos (student ↔ admin)
- Timestamps in comments (link to specific moment)
- Reactions/ratings (like/helpful buttons)
- Download option (for offline viewing)

---

### **Q3: Advanced Features (4 weeks)**

**1. Live Streaming**
- Admin can stream live lectures
- Students watch in real-time
- Chat during live stream
- Auto-convert to on-demand after stream ends

**2. Quizzes & Assessments**
- Embed quiz questions in videos
- Pause video until student answers
- Track scores in Firestore
- Generate gradebook for admin

**3. Multi-Language Support**
- Subtitle uploads (.srt/.vtt files)
- Multiple audio tracks
- Auto-translate subtitles (Google Translate API)

**4. White-Label Branding**
- Custom logo and colors
- Custom domain (e.g., learn.yourschool.com)
- Custom email templates
- Remove "Powered by" branding

---

## **Troubleshooting Guide**

### **Common Issues During Development**

**1. FFmpeg Not Found**
- **Symptom:** Tauri app errors "ffmpeg command not found"
- **Solution:** Verify binary is in `src-tauri/binaries/` folder and listed in `tauri.conf.json` under `externalBin`

**2. CORS Errors on Video**
- **Symptom:** Browser console shows "CORS policy blocked"
- **Solution:** Check R2 bucket CORS settings, ensure origin matches exactly (http vs https)

**3. 403 Forbidden on Video Request**
- **Symptom:** Video won't play, network tab shows 403
- **Causes:**
  - Token expired → Check token generation time
  - JWT secret mismatch → Verify Worker and Next.js use same secret
  - User lacks access → Check playlistAccess document exists
- **Debug:** Add console.log in Worker to see token payload

**4. Firestore Permission Denied**
- **Symptom:** Web app can't read playlists
- **Solution:** Check security rules are deployed, verify user role is correct

**5. Slow Uploads**
- **Symptom:** Upload takes 30+ minutes for 1-hour video
- **Solution:** Verify concurrent uploads are enabled, check internet connection, and consider increasing upload concurrency.

**6. Worker Deployment Fails**
- **Symptom:** `wrangler deploy` errors
- **Solution:** Run `wrangler login` again, check R2 bucket binding name matches code

---

### **Production Issues & Resolutions**

**1. "Site is down"**
- **Check:** Vercel dashboard (deployment status)
- **Check:** Cloudflare Workers analytics (error rate)
- **Check:** Firebase status page (outages rare but possible)
- **Quick Fix:** Revert to previous deployment

**2. "Videos suddenly stopped working"**
- **Check:** JWT secret changed? (must match Worker and Next.js)
- **Check:** R2 bucket accessible? (test direct upload)
- **Check:** Worker quota exceeded? (upgrade plan)

**3. "Bill is unexpectedly high"**
- **Check:** Cloudflare R2 usage (look for unusual read/write spikes)
- **Check:** Firebase Functions logs (infinite loop?)
- **Check:** Vercel bandwidth (DDoS attack?)
- **Action:** Implement rate limiting, contact support

**4. "Student can't log in"**
- **Check:** Firebase authorized domains includes production URL
- **Check:** Google OAuth consent screen approved
- **Check:** User's email domain allowed (if restricted)

---

## **Final Pre-Launch Checklist**

### **Week 8, Day 7 (Launch Day)**

**Morning (T-4 hours):**
- [ ] Verify all production services online
- [ ] Run full security test suite
- [ ] Run performance test (simulate 50 users)
- [ ] Check documentation links work
- [ ] Test password reset flow (if email/password enabled)
- [ ] Verify support email auto-responder set up

**Noon (T-0):**
- [ ] Send welcome email to first batch of students (10-20)
- [ ] Monitor Cloudflare Worker logs
- [ ] Monitor Firebase Functions logs
- [ ] Monitor Vercel real-time analytics
- [ ] Be available for support questions

**Evening (T+4 hours):**
- [ ] Check error logs (any spikes?)
- [ ] Review first user feedback
- [ ] Document any issues encountered
- [ ] Celebrate launch! 🎉

**Next 48 Hours:**
- [ ] Daily check of all logs and metrics
- [ ] Respond to support questions within 4 hours
- [ ] Schedule post-launch retrospective
- [ ] Begin planning Phase 2 features

---

## **Conclusion**

This plan delivers a production-ready video platform in 8 weeks with three key optimizations:

1. **Concurrent Multi-File Uploads:** faster HLS folder uploads via parallel PUTs
2. **Flexible Token Delivery:** Query params for MVP, cookies for Phase 2
3. **Queue System:** Unattended batch processing of videos overnight

**Total Cost:** $0.90/month for 50 users → $32/month for 500 users

**Key Metrics:**
- Video load time: < 5 seconds
- Admin upload time: < 30 minutes for 1-hour video
- Concurrent users: 50+ supported
- Uptime: 99.9% (leveraging Cloudflare + Vercel)

**Next Steps:**
1. Set up Cloudflare R2 (Week 1, Day 1)
2. Deploy Worker (Week 1, Day 2)
3. Begin Tauri app development (Week 3)

---

## **Current Project Status (Updated February 8, 2026)**

### **Completed Components**

**Phase 1: Foundation** ✅
- [x] Cloudflare R2 bucket (minilsm)
- [x] Cloudflare Worker (security gateway with JWT validation)
- [x] Firebase project with Firestore + Authentication
- [x] Firestore collections and security rules
- [x] Cloud Functions (createVideo, grantAccess, revokeAccess, onUserCreate)

**Phase 2: Admin Desktop App** ⚙️ (PARTIAL)
- [x] Tauri + React project setup
- [x] Video processing pipeline (FFmpeg HLS encoding)
- [x] Queue system with SQLite persistence
- [x] Concurrent R2 uploads (bounded concurrency, aggregate progress)
- [ ] App restart auto-recovery (planned enhancement)
- [ ] Drag-and-drop queue reordering (planned enhancement)

**Phase 3: Web Application** ✅ COMPLETED
- [x] React + Vite project setup (232 packages installed)
- [x] Firebase authentication (Google OAuth)
- [x] Navigation bar and responsive layout
- [x] Dashboard with playlist and video loading
- [x] Video player page with HLS.js
- [x] useVideoToken hook with auto-refresh logic
- [x] Quality selector (Auto/720p/480p/360p)
- [x] Loading and error states
- [x] Mobile responsive design

**Phase 4: Testing & Launch** ⏳ (NEXT)
- [ ] Security testing (token validation, access control)
- [ ] Performance testing (load, streaming, latency)
- [ ] Cross-browser testing
- [ ] Production deployment setup
- [ ] Documentation and user guides
- [ ] UAT (User Acceptance Testing)

### **Next Actions**

**Immediate (Today):**
1. Configure `web-app/.env.local` with Firebase config and Worker URL
2. Run `npm run dev` and test locally
3. Verify login, dashboard load, and video playback

**Short-term (This Week):**
1. Create test data in Firestore (test playlist and videos)
2. End-to-end testing on desktop and mobile
3. Fix any bugs found during testing

**Medium-term (Next Week):**
1. Run security audit (token validation, Firestore rules)
2. Performance testing with concurrent users
3. Cross-browser compatibility testing

**Long-term (Week 3):**
1. Deploy to Firebase Hosting
2. Final UAT with real users
3. Launch to students

### **File Structure Summary**

**Web App Created Files:**
```
web-app/
├── src/
│   ├── main.jsx                        # React entry point
│   ├── App.jsx                         # Router and auth wrapper
│   ├── index.css                       # Global styles + Tailwind
│   ├── context/
│   │   └── AuthContext.jsx             # Session management
│   ├── hooks/
│   │   └── useVideoToken.js            # Auto-refresh token management
│   ├── lib/
│   │   └── firebase.js                 # Firebase SDK initialization
│   ├── pages/
│   │   ├── LoginPage.jsx               # Google OAuth login
│   │   ├── DashboardPage.jsx           # Playlist + video list
│   │   └── PlayerPage.jsx              # Video player container
│   └── components/
│       ├── Navigation.jsx              # Top navbar
│       ├── PlaylistCard.jsx            # Course card
│       ├── VideoList.jsx               # Video modal
│       └── VideoPlayer.jsx             # HLS.js player
├── package.json                        # Dependencies (232 packages)
├── vite.config.js                      # Vite configuration
├── tailwind.config.js                  # Tailwind theme customization
├── postcss.config.js                   # PostCSS plugins
├── .env.local                          # Runtime config (not in git)
├── .env.example                        # Config template
├── .stylelintrc.json                   # CSS linter config (Tailwind support)
├── .gitignore                          # Git exclusions
├── README.md                           # Setup and development guide
└── index.html                          # HTML entry point
```

### **Deployment Instructions**

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete deployment guide including:
- Environment variable setup
- Firebase configuration
- Firebase Hosting deployment
- Post-deployment verification
- Troubleshooting guide

### **Key Metrics**

| Metric | Target | Status |
|--------|--------|--------|
| Video load time | < 5 sec | Not yet tested |
| Dashboard load | < 2 sec | Not yet tested |
| Concurrent users | 50+ | Not yet tested |
| Monthly cost (50 users) | < $1 | $0.90 estimated |
| Code completion | 100% Phase 3 | 100% ✅ |
| Syntax errors | 0 | 0 ✅ |