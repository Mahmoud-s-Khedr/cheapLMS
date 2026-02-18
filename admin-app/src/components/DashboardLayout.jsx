import { useAuth } from "../context/AuthContext";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ListVideo, Upload, Users, Settings, LogOut, Film, FileAudio } from "lucide-react";

export default function DashboardLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const isActive = (path) => location.pathname === path;

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 shadow-xl">
                <div className="h-20 flex items-center justify-center border-b border-slate-800">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        CheapLMS
                    </h1>
                </div>

                <nav className="flex-1 mt-6 px-4 space-y-1">
                    <NavItem
                        to="/"
                        icon={LayoutDashboard}
                        label="Dashboard"
                        active={isActive("/")}
                    />
                    <NavItem
                        to="/playlists"
                        icon={ListVideo}
                        label="Playlists"
                        active={isActive("/playlists")}
                    />
                    <NavItem
                        to="/queue"
                        icon={Upload}
                        label="Queue"
                        active={isActive("/queue")}
                    />
                    <NavItem
                        to="/videos"
                        icon={Film}
                        label="Videos"
                        active={isActive("/videos")}
                    />
                    <NavItem
                        to="/multimedia"
                        icon={FileAudio}
                        label="Multimedia"
                        active={isActive("/multimedia")}
                    />
                    <NavItem
                        to="/users"
                        icon={Users}
                        label="Users"
                        active={isActive("/users")}
                    />
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        <NavItem
                            to="/settings"
                            icon={Settings}
                            label="Settings"
                            active={isActive("/settings")}
                        />
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center mb-4 px-2">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                            <p className="text-xs text-slate-500 truncate">Administrator</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center justify-between px-8">
                    <h2 className="text-xl font-semibold text-slate-800">
                        {getPageTitle(location.pathname)}
                    </h2>
                </header>
                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

function NavItem({ to, icon: Icon, label, active }) {
    return (
        <Link
            to={to}
            className={`flex items-center rounded-lg px-4 py-3 transition-colors ${active
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                : "hover:bg-slate-800 hover:text-white"
                }`}
        >
            <Icon className={`mr-3 h-5 w-5 ${active ? "text-blue-200" : "text-slate-400"}`} />
            <span className="font-medium">{label}</span>
        </Link>
    );
}

function getPageTitle(path) {
    switch (path) {
        case "/": return "Dashboard";
        case "/playlists": return "Playlists";
        case "/queue": return "Video Queue";
        case "/videos": return "Video Library";
        case "/multimedia": return "Multimedia";
        case "/users": return "User Management";
        case "/settings": return "Settings";
        default: return "Admin Console";
    }
}
