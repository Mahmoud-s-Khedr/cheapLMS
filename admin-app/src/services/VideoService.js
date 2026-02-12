import {
    collection,
    addDoc,
    serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

const VIDEOS_COLLECTION = "videos";

export const VideoService = {
    // Create a new video document and increment playlist count
    create: async (videoData) => {
        try {
            // using increment from firestore
            const { increment, doc, updateDoc, addDoc, collection, serverTimestamp } = await import("firebase/firestore");
            const { db } = await import("../config/firebase");
            const VIDEOS_COLLECTION = "videos";
            const PLAYLISTS_COLLECTION = "playlists";

            // 1. Create Video
            const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), {
                ...videoData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 2. Increment Playlist Counter
            if (videoData.playlistId) {
                const playlistRef = doc(db, PLAYLISTS_COLLECTION, videoData.playlistId);
                await updateDoc(playlistRef, {
                    videoCount: increment(1),
                    updatedAt: serverTimestamp()
                });
            }

            return docRef.id;
        } catch (error) {
            console.error("Error creating video:", error);
            throw error;
        }
    }
};
