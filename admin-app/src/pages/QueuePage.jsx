import { useState } from "react";
import { useVideoQueue } from "../context/VideoQueueContext";
import { Upload, Play, Pause, Trash2, CheckCircle, XCircle, RotateCw } from "lucide-react";
import UploadModal from "../components/UploadModal";

export default function QueuePage() {
    const { queue, removeFromQueue, retryItem } = useVideoQueue();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Helper for status colors
    const getStatusColor = (status) => {
        switch (status) {
            case "completed": return "text-green-500";
            case "processing": return "text-blue-500";
            case "uploading": return "text-purple-500";
            case "error": return "text-red-500";
            default: return "text-gray-500";
        }
    };

    const StatusIcon = ({ status }) => {
        switch (status) {
            case "completed": return <CheckCircle className="h-5 w-5 text-green-500" />;
            case "error": return <XCircle className="h-5 w-5 text-red-500" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Video Queue</h1>
                <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Add Videos
                </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                {queue.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p>Queue is empty.</p>
                        <p className="text-sm mt-2">Click "Add Videos" to start uploading.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {queue.map(item => (
                            <div key={item.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                                        <StatusIcon status={item.status} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs font-medium uppercase ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                        {item.retryCount > 0 && (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                                retry #{item.retryCount}
                                            </span>
                                        )}
                                        {item.error && (
                                            <span className="text-xs text-red-500 truncate mr-2" title={item.error}>
                                                - {item.error}
                                            </span>
                                        )}
                                    </div>

                                    {(item.status === 'processing' || item.status === 'uploading') && (
                                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                                style={{ width: `${item.progress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {item.status === 'error' && (
                                        <button
                                            onClick={() => retryItem(item.id)}
                                            className="p-2 text-yellow-500 hover:text-yellow-700"
                                            title="Retry"
                                        >
                                            <RotateCw className="h-5 w-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => removeFromQueue(item.id)}
                                        className="p-2 text-gray-400 hover:text-red-600"
                                        disabled={item.status === 'processing' || item.status === 'uploading'}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
            />
        </div>
    );
}
