import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center max-w-sm text-center">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-lg font-medium text-slate-800">{message}</p>
        <p className="text-sm text-slate-500 mt-2">正在进行复杂的 AI 推理，请稍候...</p>
      </div>
    </div>
  );
};