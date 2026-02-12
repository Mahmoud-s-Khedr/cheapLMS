import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    query
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "playlists";

export const PlaylistService = {
    // Get all playlists
    getAll: async () => {
        try {
            console.log("Fetching playlists from", COLLECTION_NAME);
            const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            console.log("Playlist snapshot empty?", snapshot.empty, "Size:", snapshot.size);

            const playlists = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Parsed playlists:", playlists);
            return playlists;
        } catch (error) {
            console.error("Error fetching playlists:", error);
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
            // TODO: Check if playlist has videos before deleting?
            // For now, we allow deletion but maybe show a warning in UI.
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting playlist:", error);
            throw error;
        }
    }
};
