# SecureStream LMS — Design Decisions & Problem Framing

> This document captures the original thinking behind SecureStream LMS: why it was built, what problems it solves, and the constraints that shaped its architecture.

---

## 1. Executive Summary

SecureStream is a private, cost-optimized video streaming platform designed for course creators who need absolute control over their content without the high recurring costs of SaaS solutions.

The platform uses a **Local-First Processing** architecture: the Admin uses a custom **Tauri Desktop Application** to transcode videos locally and upload them via **concurrent multipart uploads**. Content is stored on **Cloudflare R2** (zero egress fees) and secured via **Cloudflare Workers**, resulting in a running cost of under $1.00/month for up to 50 students.

---

## 2. The Problem

- **High Costs** — Traditional video hosting platforms charge $50–$300+/month. For independent course creators, this is a blocker.
- **Privacy Control** — Public platforms lack granular, per-student access control.
- **Link Sharing / Piracy** — Naive implementations (direct URLs or pre-signed URLs) allow trivial content sharing and downloading.
- **Upload Speed** — Sequential uploads of HLS segments are too slow for large video libraries.
- **Cloud Transcoding Cost** — Cloud-based transcoding (AWS MediaConvert, Mux) adds significant per-minute costs.

---

## 3. Constraints That Shaped the Architecture

| Constraint | Impact on Design |
|---|---|
| Must stay under $5/month at 50 students | R2 for storage, Firebase free tier for backend |
| Content must not be piracy-friendly | HttpOnly JWT cookies, Worker-level validation |
| Admin must be able to process large video libraries | Local FFmpeg via Tauri sidecar |
| Upload must be fast even for 1,000+ HLS segments | Concurrent multipart upload pipeline |
| Single developer | Managed services (Firebase, Cloudflare) for auth, hosting, DB |

---

## 4. The Three Applications

### A. Admin Desktop App (Tauri + React + Rust)
- **Role**: The Content Factory & Command Center.
- **Function**: Admin manages a **Video Queue** of raw source files.
- **Processing**: Uses local FFmpeg to generate HLS playlists (720p, 480p, 360p).
- **Upload**: Uses **Concurrent Multipart Uploads** to R2 (5–10× faster than sequential).
- **Sync**: Updates Firestore with video metadata and playlist structures.

### B. Student Web App (React + Vite + Firebase)
- **Role**: The Viewing Experience.
- **Authentication**: Google OAuth (Firebase Auth).
- **Authorization**: Checks Firestore access documents before rendering any player.
- **Playback**: HLS.js player with adaptive bitrate streaming.

### C. The Security Gateway (Cloudflare Workers)
- **Role**: Security & Delivery.
- **Function**: Validates JWT tokens on every `.m3u8` and `.ts` segment request.
- **Token Delivery**: Sets an `HttpOnly; Secure` cookie — the browser never reads the token.
- **Security**: Prevents direct link sharing and enforces expiration. Tokens are scoped per video path.

---

## 5. User Workflows

**Admin workflow:**
1. Drag multiple source videos into the Tauri app and set metadata (title, description, thumbnail).
2. App transcodes videos one-by-one in the background using local FFmpeg.
3. App uploads all HLS segments concurrently to R2.
4. App registers video metadata in Firestore.
5. Admin grants specific students access via playlist-level ACL.

**Student workflow:**
1. Log in with Google.
2. See only the playlists they've been granted access to.
3. Click a video → a scoped JWT is minted and set as a cookie.
4. HLS.js streams the video from R2 via the Cloudflare Worker.

---

## 6. Key Features

- **Video Queue System** — Batch processing with pause/resume and localStorage persistence.
- **Multipart Uploads** — Fast, reliable uploads for large video libraries.
- **Adaptive Bitrate** — 720p/480p/360p auto-switching via HLS.js.
- **Role-Based Access Control** — Granular, per-student, per-playlist permissions in Firestore.
- **Zero-Egress Cost** — Cloudflare R2's pricing model eliminates egress fees.
- **Scoped JWT Tokens** — Each token is locked to a specific video path, served only as HttpOnly cookies.

---

## 7. Scalability Limits

| Metric | Value |
|---|---|
| Target concurrent users | ~50 |
| Upload bottleneck | Admin's upload bandwidth (mitigated by multipart) |
| Cost at 50 users | ~$0.90/month |
| Cost at 500 users | ~$30/month |

For larger scale (1,000+ students), evaluate: CDN layering, R2 signed URLs with short expiry, and a custom auth server to replace Firebase Functions.
