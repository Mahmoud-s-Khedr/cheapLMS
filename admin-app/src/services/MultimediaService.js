import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    orderBy,
    query,
    where
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "multimedia";

export const MultimediaService = {
    // Get all multimedia
    getAll: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching multimedia:", error);
            throw error;
        }
    },

    // Get multimedia by video ID
    getByVideoId: async (videoId) => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("videoId", "==", videoId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching multimedia by video:", error);
            throw error;
        }
    },

    // Create a new multimedia document
    create: async (multimediaData) => {
        try {
            const docData = {
                ...multimediaData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (multimediaData.id) {
                await setDoc(doc(db, COLLECTION_NAME, multimediaData.id), docData);
                return multimediaData.id;
            } else {
                const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
                return docRef.id;
            }
        } catch (error) {
            console.error("Error creating multimedia:", error);
            throw error;
        }
    },

    // Link multimedia to a video
    linkToVideo: async (multimediaId, videoId) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, multimediaId);
            await updateDoc(docRef, {
                videoId,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error linking multimedia to video:", error);
            throw error;
        }
    },

    // Unlink multimedia from a video
    unlinkFromVideo: async (multimediaId) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, multimediaId);
            await updateDoc(docRef, {
                videoId: null,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error unlinking multimedia:", error);
            throw error;
        }
    },

    // Delete multimedia
    delete: async (id) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error("Error deleting multimedia:", error);
            throw error;
        }
    }
};
