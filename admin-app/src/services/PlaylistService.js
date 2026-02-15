import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    query,
    increment,
    setDoc,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "playlists";

export const PlaylistService = {
    // Get all playlists
    getAll: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching playlists:", error);
            throw error;
        }
    },

    // Get single playlist
    get: async (id) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error fetching playlist:", error);
            throw error;
        }
    },

    // Create a new playlist
    create: async (playlistData) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...playlistData,
                videoCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating playlist:", error);
            throw error;
        }
    },

    // Update a playlist
    update: async (id, updateData) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating playlist:", error);
            throw error;
        }
    },

    // Delete a playlist
    delete: async (id) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting playlist:", error);
            throw error;
        }
    },

    // Add video to playlist
    addVideo: async (playlistId, videoId) => {
        try {
            // 1. Add to subcollection 'items'
            const itemRef = doc(db, COLLECTION_NAME, playlistId, "items", videoId);
            await setDoc(itemRef, {
                videoId,
                addedAt: serverTimestamp()
                // position: // TODO: calculate position (requires read) or handle reordering later
            });

            // 2. Update Playlist videoCount
            const playlistRef = doc(db, COLLECTION_NAME, playlistId);
            await updateDoc(playlistRef, {
                videoCount: increment(1),
                updatedAt: serverTimestamp()
            });

            // 3. Update Video's playlistIds
            const videoRef = doc(db, "videos", videoId);
            await updateDoc(videoRef, {
                playlistIds: arrayUnion(playlistId),
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error adding video to playlist:", error);
            throw error;
        }
    },

    // Remove video from playlist
    removeVideo: async (playlistId, videoId) => {
        try {
            // 1. Remove from subcollection
            await deleteDoc(doc(db, COLLECTION_NAME, playlistId, "items", videoId));

            // 2. Decrement videoCount
            const playlistRef = doc(db, COLLECTION_NAME, playlistId);
            await updateDoc(playlistRef, {
                videoCount: increment(-1),
                updatedAt: serverTimestamp()
            });

            // 3. Update Video's playlistIds
            const videoRef = doc(db, "videos", videoId);
            await updateDoc(videoRef, {
                playlistIds: arrayRemove(playlistId),
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error removing video from playlist:", error);
            throw error;
        }
    },

    // Get videos for a playlist
    getVideos: async (playlistId) => {
        try {
            // Fetch items from subcollection
            const q = query(collection(db, COLLECTION_NAME, playlistId, "items"), orderBy("addedAt", "asc"));
            const snapshot = await getDocs(q);
            const itemIds = snapshot.docs.map(doc => doc.id);

            if (itemIds.length === 0) return [];

            // We need to fetch the actual video data. 
            // Firestore 'in' query is limited to 10 or 30 items. 
            // BETTER: Fetch the video documents individually or rely on the fact 
            // that we might already have them in a central store, 
            // OR just fetch them. For a few videos, Promise.all(getDoc) is fine.

            // Note: In a large app, we'd replicate title/thumb to the link item to avoid this.
            // For now, let's fetch.

            const videoPromises = itemIds.map(id => getDoc(doc(db, "videos", id)));
            const videoDocs = await Promise.all(videoPromises);

            return videoDocs
                .filter(d => d.exists())
                .map(d => ({ id: d.id, ...d.data() }));

        } catch (error) {
            console.error("Error fetching playlist videos:", error);
            throw error;
        }
    }
};
