import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, Info } from "lucide-react";

const SEGMENT_OPTIONS = [2, 4, 6, 8, 10, 15, 20, 30, 60];

export default function SettingsPage() {
    const [segmentDuration, setSegmentDuration] = useState(4);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("hlsSegmentDuration");
        if (stored) setSegmentDuration(parseInt(stored, 10));
    }, []);

    const handleSave = () => {
        localStorage.setItem("hlsSegmentDuration", segmentDuration.toString());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <SettingsIcon className="h-7 w-7 text-slate-400" />
                <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
            </div>

            {/* HLS Segment Duration */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Video Processing</h2>
                <p className="text-sm text-slate-500 mb-6">Configure how videos are transcoded and segmented for streaming.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            HLS Segment Duration
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                {SEGMENT_OPTIONS.map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setSegmentDuration(val)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${segmentDuration === val
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                    >
                                        {val}s
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3 flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                            <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-slate-500 space-y-1">
                                <p><strong>Shorter segments (2–4s):</strong> Faster quality switching, lower latency. More HTTP requests.</p>
                                <p><strong>Longer segments (6–10s):</strong> Better compression efficiency, fewer requests. Slower quality adaptation.</p>
                                <p className="text-slate-400">Default: 4 seconds. Applied to new video uploads only.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Save className="h-4 w-4" />
                        Save Settings
                    </button>
                    {saved && (
                        <span className="text-sm text-green-600 font-medium animate-pulse">
                            ✓ Settings saved
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
