import { useEffect, useState } from "react";
import { DashboardService } from "../services/DashboardService";
import { Video, Users, HardDrive, Loader2 } from "lucide-react";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalVideos: 0,
        totalUsers: 0,
        totalPlaylists: 0,
        storageUsed: "0 GB"
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await DashboardService.getStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
                <p className="text-slate-500">Welcome back to the admin console.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Videos"
                    value={stats.totalVideos}
                    icon={Video}
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                />
                <StatsCard
                    title="Total Users"
                    value={stats.totalUsers}
                    icon={Users}
                    color="text-green-600"
                    bgColor="bg-green-50"
                />
                <StatsCard
                    title="Total Playlists"
                    value={stats.totalPlaylists}
                    icon={HardDrive}
                    color="text-purple-600"
                    bgColor="bg-purple-50"
                />
            </div>

            {/* Future: Recent Activity Table or Charts */}
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color, bgColor }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${bgColor}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
            </div>
        </div>
    );
}
