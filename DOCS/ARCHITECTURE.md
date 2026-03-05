# 🏗️ SecureStream LMS — Architecture Deep Dive

> This document covers the "why" behind the major design decisions in SecureStream LMS. For setup instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Executive Summary

SecureStream LMS is engineered to solve the primary friction point of independent video hosting: **egress costs**. By shifting the intensive transcoding workload to the admin's local machine via a Rust/Tauri sidecar, and routing all video delivery through Cloudflare's zero-egress R2 storage, the system achieves near-zero operational costs ($1/month for 50 users). Security is enforced at the edge via Cloudflare Workers validating signed JWTs embedded in HttpOnly cookies, ensuring video links cannot be shared or pirated.

---

## 1. The Core Problem This Architecture Solves

Traditional self-hosted video platforms have three failure modes:

1. **Cost explosion** — Cloud transcoding (AWS Elemental, Mux) is $0.015–0.030/minute of video. A 10-hour course costs $9–$18 just to process.
2. **Piracy via link sharing** — Direct object storage URLs (S3 pre-signed URLs) can be downloaded or shared trivially.
3. **Slow upload** — Uploading 10 GB of HLS segments sequentially (one at a time) to object storage can take 30–60 minutes on a 100 Mbps line.

SecureStream solves all three.

---

## 2. System Overview

```
┌─────────────────────────────────────────┐
│       Admin Desktop App (Tauri)         │
│  FFmpeg sidecar → HLS segments          │
│  Concurrent multipart upload → R2       │
│  Firestore metadata sync                │
└────────────────────┬────────────────────┘
                     │
         ┌───────────▼───────────┐
         │    Cloudflare R2      │  ← Zero-egress object storage
         │  (HLS segments +      │
         │   thumbnails)         │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Cloudflare Worker    │  ← JWT validation on every segment
         └───────────┬───────────┘
                     │ (validated, cached)
┌────────────────────▼────────────────────┐
│       Student Web App (React)           │
│  Google OAuth → Firebase Auth           │
│  generateToken Cloud Function           │
│  HLS.js adaptive player                 │
└─────────────────────────────────────────┘
```

---

## 3. Why Each Technology Was Chosen

### Cloudflare R2 (Storage)
**Why not S3 or Firebase Storage?**

| Provider | Egress Cost | Notes |
|---|---|---|
| AWS S3 | $0.09/GB | Significant for video |
| GCS / Firebase Storage | $0.12/GB | Higher than S3 |
| Cloudflare R2 | **$0.00/GB** | Zero egress when served via Worker |

For a video platform, egress is the dominant cost. R2's zero-egress model is the single biggest reason the platform runs under $1/month.

**Trade-off:** R2 has no built-in CDN — but routing all requests through a Cloudflare Worker (which sits on Cloudflare's global edge network) provides equivalent CDN behavior with the added benefit of JWT validation at the edge.

---

### Cloudflare Worker (Security Gateway)
**Why not pre-signed URLs?**

Pre-signed URLs are the naive solution. They have two fundamental problems:
1. The URL itself is visible in browser DevTools — trivially copyable.
2. Once shared, there's no way to invalidate a pre-signed URL before it expires.

The Worker approach:
- The `.m3u8` playlist URL is `https://worker.domain.com/path/to/playlist.m3u8`
- The Worker validates a JWT on **every** request
- The JWT is stored in an `HttpOnly; Secure; SameSite=None` cookie
- The browser never sees the token value or the underlying R2 URL

```
Student → Worker (validates JWT cookie) → R2 (private, no public URL)
```

**Token scoping:** Each JWT contains the `videoPath` claim. Even if a student somehow extracted a token for Video A, it cannot be used to access Video B (the Worker checks `videoPath` against the request path).

**Public Routes:** The Worker is configured to safely bypass JWT validation for specific prefixes (`thumbnails/` and `multimedia/`). This allows images and downloadable resources to be served directly from R2 without complex token management, while applying caching (`Cache-Control: public, max-age=3600`) and CORS headers.

---

### Tauri (Admin Desktop App)
**Why a desktop app instead of a web admin panel?**

The critical constraint is **local FFmpeg transcoding**. Running FFmpeg in the browser is theoretically possible (via WebAssembly) but extremely slow — Wasm FFmpeg runs at ~10% of native speed. For a 1-hour video at 1080p, that's the difference between 5 minutes and 50 minutes of processing time.

Tauri allows:
- Spawning native FFmpeg as a **sidecar binary** (bundled with the app)
- Real-time progress reporting from FFmpeg stdout via Tauri events
- Native file system access for reading source videos

**Why Tauri instead of Electron?**
- 5–10× smaller binary size (Rust backend vs. Node.js)
- Lower memory usage (no separate Node.js process)
- Native OS integration without the overhead

---

### Firebase (Auth + Database)
**Why Firebase over a custom backend?**

For this scale (50–500 students), Firebase's free tier covers all auth and database operations. The trade-offs are acceptable:

| Concern | Mitigation |
|---|---|
| Vendor lock-in | Firestore data is exportable; migration path exists |
| Cost at scale | At 5,000+ students, evaluate self-hosted Supabase |
| Cold starts | Functions are deployed to `europe-west1` for EU latency |

Firebase Auth handles Google OAuth out of the box with one dependency. Building equivalent auth from scratch would add weeks of development time with equivalent security.

---

## 4. Security Model — Token Flow

```
1. Student opens the web app
        │
        ▼
2. Firebase Auth (Google OAuth) issues a Firebase ID Token
        │
        ▼
3. Student's browser calls Cloud Function: generateToken
   - Function verifies the Firebase ID Token
   - Function checks Firestore: does playlistAccess/{userId_playlistId} exist?
   - If yes: mint a signed JWT { videoPath, userId, exp: now+1hr }
   - Return JWT to browser
        │
        ▼
4. Browser calls: Worker /video/{path}/playlist.m3u8
   - Sends JWT in Authorization header (first request)
   - Worker validates JWT signature and videoPath claim
   - Worker sets HttpOnly cookie: secureclaim={jwt}
   - Worker proxies response from R2
        │
        ▼
5. For all subsequent .ts segment requests:
   - Browser sends cookie automatically (HttpOnly — JS can't read it)
   - Worker validates cookie JWT on every segment
   - R2 remains completely private (no public URL)
```

**Token auto-refresh:** The `useVideoToken` React hook monitors JWT expiry and calls `generateToken` proactively ~5 minutes before expiry to prevent playback interruption.

---

## 5. Upload Pipeline — Concurrent Multipart

Sequential upload of 1,000 HLS segments (for a 1-hour video at 10-second segments) at ~500ms per segment = **8+ minutes** of upload time.

The multipart upload pipeline:
1. FFmpeg outputs ~1,000 `.ts` segment files + 1 `.m3u8` playlist per quality tier
2. The admin app discovers all files in the output directory
3. Files are queued into a concurrent upload pool (configurable concurrency, default 8)
4. Each file uses the S3 multipart upload API (`@aws-sdk/client-s3`) to R2
5. Upload progress is tracked per-file and aggregated for the queue UI

Result: **5–10× faster** than sequential upload, saturating the admin's upload bandwidth.

---

## 6. Firestore Schema — Design Rationale

```
users/{uid}
  email, role (admin|student), displayName

playlists/{playlistId}
  title, description, videoCount, thumbnailUrl, coverUrl
  └─ items/{itemId} (subcollection for ordered playlist contents)

videos/{videoId}
  title, description, playlistId, r2Path, thumbnailUrl,
  qualities (array: [{label: '1080p', path: '...'}]),
  durationSeconds
  └─ comments/{commentId} (subcollection for video discussion)

playlistAccess/{userId_playlistId}
  userId, playlistId, grantedBy (adminUid), grantedAt

multimedia/{multimediaId}
  title, r2Path, sizeBytes, type

notifications/{notificationId}
  title, message, type, targetId (uid or 'all'), createdAt

uploadQueue/{itemId}
  status, progress, files
```

**Key design decisions:**
- `playlistAccess` uses a composite document ID (`{userId}_{playlistId}`) for O(1) existence checks in Firestore Security Rules — no array searches needed.
- Videos are not subcollections of playlists — they're top-level with a `playlistId` field. This makes cross-playlist queries (future feature) possible without collection group queries.
- `qualities` is an array of objects, not separate documents. The number of quality tiers per video is bounded (max ~5), so this doesn't hit Firestore document size limits.

---

## 7. Cost Analysis

### At 50 Students

| Resource | Usage | Cost |
|---|---|---|
| Cloudflare R2 Storage | 50 GB | $0.75/month |
| Cloudflare Worker Requests | ~500K | Free (first 100K/day free) |
| Firebase Auth | ≤ 50K MAU | Free tier |
| Firestore reads/writes | Low | Free tier |
| Firebase Functions | Low invocations | Free tier |
| **Total** | | **~$0.90/month** |

### At 500 Students

| Resource | Usage | Cost |
|---|---|---|
| R2 Storage | 500 GB | $7.50/month |
| Worker Requests | ~5M | ~$0.50 |
| Firestore reads | ~10M | ~$3 |
| Functions invocations | ~500K | ~$0.10 |
| Firebase Auth | Free tier | $0 |
| **Total** | | **~$11–$30/month** |

The cost scales sub-linearly with student count because Cloudflare's free tiers are generous and R2 egress remains zero.
