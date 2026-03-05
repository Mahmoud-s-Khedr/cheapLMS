# Platform Updates Implementation Plan

This plan outlines the architecture and implementation steps for adding the new requested features: Video Comments, Video Metadata, Multimedia UI Improvements, Notifications, and Playlist Covers.

## Proposed Changes

### 1. Video Comments
- [x] **Database Schema**: Add a new subcollection `comments` under `videos/{videoId}/comments`.
  - Fields: `text` (string), `userId` (string), `userName` (string), `createdAt` (timestamp).
- [x] **Firestore Rules**: 
  - Allow authenticated users to read.
  - Allow authenticated users to create comments (where `request.resource.data.userId == request.auth.uid`).
  - Allow admins to delete/manage any comment.
- [x] **Web App UI**: Add a `CommentSection` component below the video player allowing students to view and post comments.
- [x] **Admin App UI**: Add a moderation interface in the video details view to delete inappropriate comments.

### 2. Video Title & Description
- [x] **Database Schema**: Add `title` and `description` string fields to the existing `videos` collection documents.
- [x] **Admin App UI**: Add text inputs for Title and Description in the Video Upload/Edit modals.
- [x] **Web App UI**: Display the title and description below the video player in the `VideoDetails` view.

### 3. Multimedia Display Improvements
- [x] **Web App UI**: 
  - Upgrade the current simple link list to a responsive grid layout using Tailwind CSS cards.
  - Add visual identifiers (icons) for different content types (PDF, Word doc, external links, etc.).
  - Add download buttons or clear call-to-action styling.

### 4. Notification System
- [x] **Database Schema**: Create a new `notifications` root collection.
  - Fields: `title`, `message`, `type` (e.g., 'system', 'course', 'admin'), `targetId` (either user UID or `'all'` for broadcasts), `createdAt`.
- [x] **Firestore Rules**:
  - Allow users to read notifications where `targetId == request.auth.uid` or `targetId == 'all'`.
  - Allow admins to read/write all.
- [x] **Web App UI**: Implement a Notification Bell in the Navbar with a dropdown menu indicating unread notifications.
- [x] **Admin App UI**: Add a "Send Notification" interface to push updates either globally (`targetId: 'all'`) or to specific students.

### 5. Playlist Cover Upload
- [x] **Database Schema**: Add a `coverUrl` string field to the existing `playlists/{playlistId}` documents.
- [x] **Admin App UI**: 
  - During Playlist creation or editing, add an image upload component.
  - Implement upload logic to send the cover image to the storage bucket (Cloudflare R2 or Firebase Storage) and save the resulting URL.
- [x] **Web App UI**: Use the `coverUrl` to display a rich thumbnail/cover for playlists in the student's dashboard.

## Verification Plan
### Automated Tests
- Validate Firestore Rules offline using the Firebase Emulator Suite to ensure only admins can manipulate notifications globally, and students can only post their own comments.
### Manual Verification
- Deploy the updated Cloud Firestore rules and run the Web App locally to verify comment posting functionality.
- Test uploading a new Playlist cover through the Admin App using the dev environment and verify the `coverUrl` appears in the database and renders in the Web App.
- Send a broadcast notification from the Admin App and confirm it appears instantly in the Web App's notification dropdown.
