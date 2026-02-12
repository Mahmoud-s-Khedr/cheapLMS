# Admin Desktop App Plan

This document outlines the design and implementation plan for the **Admin Desktop App**, a Tauri-based application for managing the SecureStream LMS.

## **1. Project Overview**

**Goal:** Provide a secure, desktop-based interface for administrators to manage video content, users, and access permissions.
**Tech Stack:**
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Rust (Tauri Core)
- **Database:** SQLite (local queue state) + Firestore (cloud data)
- **Video Processing:** FFmpeg (bundled binary)
- **Storage:** Cloudflare R2 (video hosting)

## **2. Authentication**

**Requirement:** Admin logs in with Email and Password.

### **Implementation Details:**
- **Provider:** Firebase Authentication (Email/Password).
- **Security:**
  - Login page is the entry point.
  - On successful login, check if the user has the `admin` role in their Firestore `users/{uid}` document.
  - If not admin, deny access and sign out.
  - Persist session using Firebase Auth persistence (LOCAL).

### **UI Components:**
- **Login Screen:**
  - Email input
  - Password input
  - "Sign In" button
  - Error message display (e.g., "Invalid credentials", "Access denied")

## **3. Content Management**

### **3.1 Playlist Management**
**Features:**
- **List Playlists:** View all courses/playlists with metadata (title, video count, thumbnail).
- **Create Playlist:**
  - Input: Title, Description, Thumbnail URL (optional).
  - output: New document in `playlists` collection.
- **Update Playlist:** Edit title, description, thumbnail.
- **Delete Playlist:**
  - **Warning:** Should check for existing videos/access grants before deletion or cascade delete (requires strict confirmation).
  - *Phase 1 Strategy:* Soft delete or strict barrier (cannot delete if videos exist).

### **3.2 Video Management**
**Features:**
- **Add Videos:**
  - Handled by the **Video Queue System** (drag-and-drop, FFmpeg processing, R2 upload).
  - *Ref:* See `DOCS/plan.md` section 3 for Queue details.
- **Update Video Metadata:**
  - Edit Title, Description.
  - **Change Playlist:** Move video to a different playlist.
    - *Action:* Update `playlistId` field in `videos/{videoId}`.
    - *Action:* Update `position` field.
    - *Action:* Update `videoCount` in old and new playlists.
- **Remove Video:**
  - Delete from Firestore `videos` collection.
  - Delete files from R2 (optional but recommended for cleanup).
  - Update playlist `videoCount`.

## **4. User Management**

### **4.1 User List**
**Features:**
- **View All Users:**
  - Table showing: Avatar, Name, Email, Role, Created At.
  - **Search:** Filter by email or name.
  - **Pagination:** Essential for large user bases.

### **4.2 Access Control (Grant & Revoke)**
**Features:**
- **Grant Access:**
  - Select User -> Select Playlist -> "Grant Access".
  - **Action:** Call Cloud Function `grantAccess` or write directly to Firestore `playlistAccess/{playlistId}_{userId}`.
    - *Note:* Direct Firestore write is faster if Admin has permission. Cloud Function is safer for validation.
    - *Decision:* Use Direct Write for Admin App for speed/offline-first feel, use Cloud Functions for complex logic if needed. For now, Direct Write is fine.
    - **Document ID:** `${playlistId}_${userId}`
    - **Fields:** `playlistId`, `userId`, `grantedAt`, `grantedBy`.
- **Revoke Access:**
  - View list of accessible playlists for a selected user.
  - Click "Revoke" on a specific playlist.
  - **Action:** Delete document from `playlistAccess`.
- **Manage by Playlist:**
  - Alternatively, select a Playlist -> View all users with access -> Add/Remove users.

## **5. UI/UX Structure**

### **Navigation (Sidebar)**
- **Dashboard:** Overview stats (total users, total videos, storage usage).
- **Playlists:** Manage courses and videos (browse by hierarchy).
- **Queue:** Video upload/processing status.
- **Users:** User management and access control.
- **Settings:** App configuration (FFmpeg path, R2 keys).

## **6. Technical Implementation Roadmap**

### **Phase 2.1: Admin Auth & Shell (Week 3)**
- [ ] Initialize Tauri project with React/Vite.
- [ ] Setup Firebase Auth (Email/Password).
- [ ] Implement Admin Role protection.
- [ ] Build App Shell (Sidebar, routing).

### **Phase 2.2: Content Management (Week 3)**
- [ ] **Playlists CRUD:**
    - Firestore service for `playlists`.
    - UI: Playlist list, Create/Edit modals.
- [ ] **Video Metadata:**
    - UI: Video list within a playlist.
    - UI: "Move to Playlist" dropdown.
    - Firestore updates for moving videos.

### **Phase 2.3: Video Processing (Week 3-4)**
- [ ] *As defined in `DOCS/plan.md` Task 2.1 & 2.2*.

### **Phase 2.4: User & Access Management (Week 4)**
- [ ] **User List:**
    - Fetch users from `users` collection.
    - Search/Filter logic.
- [ ] **Access Control:**
    - UI: "Manage Access" modal (User-centric or Playlist-centric).
    - Firestore service for `playlistAccess`.

## **7. Data Security**
- **Admin App:** Has privileged access (Firebase Admin SDK or Client SDK with Admin Custom Claims).
- *Recommendation:* Use Client SDK for Auth. Use Firestore Rules to allow `write` only if `request.auth.token.role == 'admin'`.

