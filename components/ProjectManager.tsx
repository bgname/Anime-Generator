
import React, { useState } from 'react';
import { FolderPlus, FolderOpen, Film, ArrowRight, Loader2 } from 'lucide-react';

interface ProjectManagerProps {
  onCreate: (name: string) => void;
  onOpen: () => void;
  isLoading: boolean;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onCreate, onOpen, isLoading }) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [mode, setMode] = useState<'menu' | 'create'>('menu');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreate(newProjectName.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">剧本可视化工具</h1>
          <p className="text-indigo-100 text-sm">AI 驱动的剧本拆解与分镜生成助手</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-500">正在处理项目文件...</p>
            </div>
          ) : mode === 'menu' ? (
            <div className="space-y-4">
              <button
                onClick={() => setMode('create')}
                className="w-full group relative flex items-center p-4 bg-white border-2 border-slate-100 hover:border-indigo-100 rounded-xl hover:shadow-lg transition-all text-left"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FolderPlus className="w-6 h-6" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-bold text-slate-800">新建项目</h3>
                  <p className="text-xs text-slate-500 mt-1">创建新文件夹开始新的剧本创作</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={onOpen}
                className="w-full group relative flex items-center p-4 bg-white border-2 border-slate-100 hover:border-indigo-100 rounded-xl hover:shadow-lg transition-all text-left"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-bold text-slate-800">打开项目</h3>
                  <p className="text-xs text-slate-500 mt-1">选择已有的项目文件夹继续编辑</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">项目名称</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="例如：我的微电影"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  选择位置并创建
                </button>
              </div>
              <p className="text-xs text-center text-slate-400 mt-4">
                点击“创建”后，请在弹出的窗口中选择一个父文件夹保存项目。
              </p>
            </form>
          )}
        </div>
      </div>
      <p className="mt-8 text-xs text-slate-400">© 2025 Ubanquan Script Visualizer</p>
    </div>
  );
};
