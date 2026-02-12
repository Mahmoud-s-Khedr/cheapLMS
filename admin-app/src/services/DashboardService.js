import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

export const DashboardService = {
    getStats: async () => {
        try {
            const videosColl = collection(db, "videos");
            const usersColl = collection(db, "users");
            // Storage calculation is tricky without Cloud Functions or iterating all files. 
            // For now, we will mock storage or sum up a 'size' field if we had one.
            // Let's count playlists too to have 3 stats if storage is hard.
            const playlistsColl = collection(db, "playlists");

            const [videosSnapshot, usersSnapshot, playlistsSnapshot] = await Promise.all([
                getCountFromServer(videosColl),
                getCountFromServer(usersColl),
                getCountFromServer(playlistsColl)
            ]);

            return {
                totalVideos: videosSnapshot.data().count,
                totalUsers: usersSnapshot.data().count,
                totalPlaylists: playlistsSnapshot.data().count,
                storageUsed: "N/A" // Placeholder until we track file sizes
            };
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
            throw error;
        }
    }
};
