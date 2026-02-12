# Project Title: SecureStream LMS (Local-First Architecture)

## 1. Executive Summary
SecureStream is a private, cost-optimized video streaming platform designed for course creators who need absolute control over their content without the high recurring costs of SaaS solutions.

The platform utilizes a unique "Local-First Processing" architecture. The Admin uses a custom **Tauri Desktop Application** to transcode videos locally and upload them via **concurrent multipart uploads**. Content is stored on **Cloudflare R2** (zero egress fees) and secured via **Cloudflare Workers**, resulting in a running cost of <$1.00/month for up to 50 students.

## 2. The Problem It Solves
*   **High Costs**: Traditional video hosting is expensive.
*   **Privacy Control**: Public platforms lack granular access control.
*   **Link Sharing**: Naive implementations allow piracy.
*   **Upload Speed**: Sequential uploads of HLS segments are too slow.

## 3. The Solution Architecture
The project consists of three distinct applications:

### A. Admin Desktop App (Tauri + React + Rust)
*   **Role**: The Content Factory & Command Center.
*   **Function**: Admin manages a **Video Queue** of raw files.
*   **Processing**: Uses local FFmpeg to generate HLS playlists (720p, 480p, 360p).
*   **Upload**: Uses **Concurrent Multipart Uploads** to R2 (5-10x faster than sequential).
*   **Sync**: Updates Firestore with video metadata and playlist structures.

### B. The User Web App (React + Vite + Firebase)
*   **Role**: The Viewing Experience.
*   **Authentication**: Google OAuth (Firebase Auth).
*   **Authorization**: Checks Firestore "Access List" before rendering.
*   **Playback**: HLS.js player with adaptive streaming.

### C. The Gatekeeper (Cloudflare Workers)
*   **Role**: Security & Delivery.
*   **Function**: Validates JWT tokens on every segment request.
*   **Token Delivery**: HTTP-Only Cookies (Secure, HttpOnly, SameSite=Strict).
*   **Security**: Prevents direct link sharing and enforces expiration. Tokens are hidden from the user.

## 4. Technical Stack
| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Admin App** | **Tauri (Rust + React)** | High-performance desktop app with small bundle size. |
| **Video Engine** | FFmpeg | Local transcoding to HLS. |
| **Web Frontend** | React + Vite | Fast SPAs, hosted on Firebase Hosting. |
| **Auth** | Firebase Auth | Google Sign-In only. |
| **Database** | Firestore | User permissions, playlists, queue status. |
| **Storage** | Cloudflare R2 | Object storage with zero egress fees. |
| **Edge Logic** | Cloudflare Workers | JWT validation and secure stream delivery. |

## 5. User Journey (Workflow)
1.  **Queue**: Admin drags multiple videos into the Tauri app and sets metadata.
2.  **Batch Processing**: App transcodes videos one by one in the background.
3.  **Fast Upload**: App uploads chunks concurrently to R2.
4.  **Access**: Student logs in via Google; Web App verifies access in Firestore.
5.  **Stream**: Web App requests signed URL; Worker validates token and streams video.

## 6. Key Features
*   **Video Queue System**: Batch processing with pause/resume and persistence.
*   **Multipart Uploads**: Fast, reliable uploads for large video libraries.
*   **Adaptive Bitrate**: 720p/480p/360p auto-switching.
*   **Role-Based Access**: Granular permission control.
*   **Zero-Egress Cost**: Leveraging R2's pricing model.

## 7. Scalability & Limits
*   **Capacity**: Tested for ~50 concurrent users.
*   **Bottleneck**: Admin upload speed (mitigated by multipart uploads).
*   **Cost Estimate**:
    *   **50 Users**: ~$0.90/month (Storage primarily).
    *   **500 Users**: ~$30.60/month (Storage + Bandwidth/Requests).