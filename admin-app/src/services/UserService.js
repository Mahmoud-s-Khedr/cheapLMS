import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    query,
    where,
    getDoc,
    setDoc
} from "firebase/firestore";
import { db } from "../config/firebase";

const USERS_COLLECTION = "users";
const PLAYLIST_ACCESS_COLLECTION = "playlistAccess";

export const UserService = {
    // Get all users
    getAll: async () => {
        try {
            const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
        }
    },

    // Get playlist access for a user
    getUserAccess: async (userId) => {
        try {
            const q = query(collection(db, PLAYLIST_ACCESS_COLLECTION), where("userId", "==", userId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching user access:", error);
            throw error;
        }
    },

    // Grant access
    grantAccess: async (playlistId, userId, grantedByEmail) => {
        try {
            const docId = `${playlistId}_${userId}`;
            const accessRef = doc(db, PLAYLIST_ACCESS_COLLECTION, docId);
            const accessDoc = await getDoc(accessRef);

            if (accessDoc.exists()) {
                return; // Already granted
            }

            await setDoc(accessRef, {
                playlistId,
                userId,
                grantedBy: grantedByEmail,
                grantedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error granting access:", error);
            throw error;
        }
    },

    // Revoke access
    revokeAccess: async (accessId) => {
        try {
            await deleteDoc(doc(db, PLAYLIST_ACCESS_COLLECTION, accessId));
        } catch (error) {
            console.error("Error revoking access:", error);
            throw error;
        }
    },

    // Get all users who have access to a specific playlist
    getPlaylistAccess: async (playlistId) => {
        try {
            const q = query(
                collection(db, PLAYLIST_ACCESS_COLLECTION),
                where("playlistId", "==", playlistId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
        } catch (error) {
            console.error("Error fetching playlist access:", error);
            throw error;
        }
    },

    // Bulk revoke access for multiple users at once
    bulkRevokeAccess: async (playlistId, userIds) => {
        try {
            const { writeBatch } = await import("firebase/firestore");
            const batch = writeBatch(db);
            for (const userId of userIds) {
                const accessId = `${playlistId}_${userId}`;
                batch.delete(doc(db, PLAYLIST_ACCESS_COLLECTION, accessId));
            }
            await batch.commit();
        } catch (error) {
            console.error("Error bulk revoking access:", error);
            throw error;
        }
    }
};
