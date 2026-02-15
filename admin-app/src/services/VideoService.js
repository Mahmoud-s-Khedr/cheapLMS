import {
    collection,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    getDocs,
    arrayUnion
} from "firebase/firestore";
import { db } from "../config/firebase";

const VIDEOS_COLLECTION = "videos";

export const VideoService = {
    // Get all videos
    getAll: async () => {
        try {
            const q = query(collection(db, VIDEOS_COLLECTION), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching videos:", error);
            throw error;
        }
    },

    // Create a new video document
    create: async (videoData) => {
        try {
            // playlistId is now optional. If provided, we add it to the playlistIds array.
            const initialPlaylistIds = videoData.playlistId ? [videoData.playlistId] : [];

            // Allow passing playlistId for backward compatibility or direct assignment, 
            // but don't store it as a single field if we want to be pure.
            // However, we should keep 'playlistId' (singular) for now if we want to avoid breaking everything immediately,
            // OR fully switch to 'playlistIds'. 
            // Let's store BOTH for transition: playlistIds array.

            const docData = {
                ...videoData,
                playlistIds: initialPlaylistIds, // New field for independent videos
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Remove legacy single playlistId from main object if we want to be strict, 
            // but for now let's keep it if the UI uses it, but logic should rely on playlistIds
            if (videoData.playlistId) {
                // We'll handle the actual linkage (subcollection) in the caller or here?
                // The plan said: "UploadModal ... If Playlist selected -> Add to Library + Link to Playlist"
                // Ideally this service just creates the video.
            }

            let docId;
            if (videoData.id) {
                // Use provided ID (e.g., from VideoQueueContext UUID)
                await setDoc(doc(db, VIDEOS_COLLECTION, videoData.id), docData);
                docId = videoData.id;
            } else {
                // Auto-generate ID
                const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), docData);
                docId = docRef.id;
            }

            // If a playlist was specified, we should ideally add it to that playlist's subcollection too.
            // But let's keep this function atomic to creating the video. 
            // The Context or UI should call PlaylistService.addVideo() separately if needed,
            // OR we do it here. Doing it here ensures consistency.
            if (videoData.playlistId) {
                const { PlaylistService } = await import("./PlaylistService");
                // We need to avoid circular dependencies if PlaylistService imports VideoService.
                // Dynamic import helps.
                await PlaylistService.addVideo(videoData.playlistId, docId);
            }

            return docId;
        } catch (error) {
            console.error("Error creating video:", error);
            throw error;
        }
    },

    update: async (id, data) => {
        try {
            const docRef = doc(db, VIDEOS_COLLECTION, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating video:", error);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            // 1. Delete from Firestore
            await deleteDoc(doc(db, VIDEOS_COLLECTION, id));

            // 2. R2 Deletion
            // For now, we are triggering this from Frontend or Cloud Function?
            // The plan said "Invoke Tauri delete_r2_folder".
            // Since we couldn't implement it in Rust, we have to do it in frontend context 
            // OR ignore it and let a scheduled function clean it up.
            // Let's assume the caller (Context) handles the R2 part to keep Service pure-ish 
            // or we move the R2 logic here. 
            // Since R2 logic depends on Tauri/AWS SDK imports, better to keep it in a helper or Context.

            return true;
        } catch (error) {
            console.error("Error deleting video:", error);
            throw error;
        }
    }
};
