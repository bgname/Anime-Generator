
import React from 'react';
import { X, Key, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  apiKey, 
  onApiKeyChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded text-indigo-600">
                <Key className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800">全局设置</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
              Coze API Key
              {apiKey && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> 已配置</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
              placeholder="pat_..."
            />
            <p className="mt-2 text-xs text-slate-400">
              此 API Key 为全局配置，将应用于所有项目。请确保您拥有 Coze API 的访问权限。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
