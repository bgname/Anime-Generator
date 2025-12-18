
import React, { useState } from 'react';
import { GenerationHistoryItem } from '../types';
import { X, Download, Clock, Image as ImageIcon, Check, FolderOpen } from 'lucide-react';
import { downloadHistoryItem } from '../utils/zipUtils';
import { saveToWorkspace } from '../services/fileService';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: GenerationHistoryItem[];
  workspaceHandle?: any;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose, history, workspaceHandle }) => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSave = async (item: GenerationHistoryItem) => {
    setSavingId(item.id);
    try {
        if (workspaceHandle) {
            // Optimization 2: Directly save to folder
            await saveToWorkspace(workspaceHandle, item);
        } else {
            // Fallback: Download Zip
            const infoText = `【名称】\n${item.name}\n\n` +
                             `【${item.type === 'character' ? '定位' : '地点'}】\n${item.roleOrLocation}\n\n` +
                             (item.type === 'character' ? `【设定】\n${item.description}\n\n` : '') +
                             `【特征】\n${item.traits}\n\n` +
                             `【提示词】\n${item.prompt}`;
            await downloadHistoryItem(item.name, infoText, item.images);
        }
    } finally {
        setTimeout(() => setSavingId(null), 1000);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
  };

  return (
    <>
        {/* Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" 
                onClick={onClose}
            />
        )}

        {/* Sidebar */}
        <div className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    生成历史记录
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Workspace status */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-[10px] text-slate-500">
                <FolderOpen className="w-3 h-3" />
                {workspaceHandle ? `工作区: ${workspaceHandle.name}` : "未链接本地工作区，保存将下载 ZIP"}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {history.length === 0 ? (
                    <div className="text-center text-slate-400 mt-10 text-sm">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>暂无生成记录</p>
                    </div>
                ) : (
                    history.slice().reverse().map((item) => (
                        <div key={item.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-700 text-sm">{item.name}</h4>
                                    <span className="text-xs text-slate-400 font-mono">{formatDate(item.timestamp)}</span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.type === 'character' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                    {item.type === 'character' ? '角色' : '场景'}
                                </span>
                            </div>
                            
                            {/* Images Preview */}
                            <div className="p-3 grid grid-cols-3 gap-2">
                                {item.images.slice(0, 3).map((img, idx) => (
                                    <div key={idx} className="aspect-square bg-slate-100 rounded overflow-hidden border border-slate-200">
                                        {img ? (
                                            <img src={img} className="w-full h-full object-cover" alt="gen" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <ImageIcon className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="px-3 pb-3">
                                <button 
                                    onClick={() => handleSave(item)}
                                    disabled={savingId === item.id}
                                    className={`w-full flex items-center justify-center gap-2 border text-xs py-2 rounded transition-all font-medium ${
                                        savingId === item.id 
                                        ? 'bg-green-50 border-green-200 text-green-600' 
                                        : 'bg-white border-slate-300 hover:border-indigo-300 hover:text-indigo-600 text-slate-600'
                                    }`}
                                >
                                    {savingId === item.id ? (
                                        <>
                                            <Check className="w-3 h-3" />
                                            {workspaceHandle ? "已存入工作区" : "已导出 ZIP"}
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-3 h-3" />
                                            {workspaceHandle ? "存入本地文件夹" : "下载设定与图片 (Zip)"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </>
  );
};
