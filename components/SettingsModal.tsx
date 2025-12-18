
import React, { useRef } from 'react';
import { X, Key, FolderOpen, Download, Upload, CheckCircle2 } from 'lucide-react';
import { exportProjectConfig } from '../services/fileService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  workspaceName?: string;
  onSelectWorkspace: () => void;
  projectState: any;
  onImportConfig: (config: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  apiKey, 
  onApiKeyChange,
  workspaceName,
  onSelectWorkspace,
  projectState,
  onImportConfig
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportConfig(json);
      } catch (err) {
        alert("无效的 JSON 配置文件");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded text-indigo-600">
                <Key className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800">设置与配置</h3>
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
          </div>

          {/* Workspace Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              本地工作区 (文件夹)
            </label>
            <button 
              onClick={onSelectWorkspace}
              className={`w-full flex items-center justify-center gap-2 p-3 border rounded-lg transition-all ${workspaceName ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-300 hover:border-indigo-400 text-slate-600'}`}
            >
              <FolderOpen className="w-4 h-4" />
              {workspaceName ? `已链接: ${workspaceName}` : "选择本地存储文件夹"}
            </button>
            <p className="mt-2 text-[10px] text-slate-400 italic">
              链接后，生成的资源将直接保存到该文件夹，无需手动下载。
            </p>
          </div>

          {/* Data Management Section */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <button 
                onClick={() => exportProjectConfig(projectState)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
                <Download className="w-4 h-4" />
                导出配置 (JSON)
            </button>
            <button 
                onClick={handleImportClick}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
                <Upload className="w-4 h-4" />
                导入配置 (JSON)
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
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
