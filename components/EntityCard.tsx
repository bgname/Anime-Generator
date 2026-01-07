
import React, { useState, useEffect } from 'react';
import { Character, Scene } from '../types';
import { Wand2, Image as ImageIcon, RefreshCw, Loader2, Plus, Trash2 } from 'lucide-react';

interface EntityCardProps {
  entity: Character | Scene;
  globalEntity?: Character | Scene; // Added optional global entity for reference
  type: 'character' | 'scene';
  onUpdate: (id: string, field: string, value: any) => void;
  onGeneratePrompt: (id: string) => void;
  onGenerateImage: (id: string, model?: string) => void;
  onShowDialog: (message: string, onConfirm: () => void) => void;
  onPreviewImage: (url: string) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ 
  entity, 
  globalEntity,
  type, 
  onUpdate, 
  onGeneratePrompt,
  onGenerateImage,
  onShowDialog,
  onPreviewImage
}) => {
  // For scenes and characters (unified), we use the gallery logic
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewingGlobal, setViewingGlobal] = useState(false); // Track if we are viewing a global image
  const [model, setModel] = useState('Doubao-Seedream-4.0');

  // Reset selection when entity changes
  useEffect(() => {
    setSelectedImageIndex(0);
    setViewingGlobal(false);
    setModel('Doubao-Seedream-4.0');
  }, [entity.id]);

  // Helper to safely access properties
  const roleOrLocation = type === 'character' ? (entity as Character).role : (entity as Scene).location;
  const roleLabel = type === 'character' ? '角色定位' : '场景定位';
  
  const currentImages = entity.images || [];
  
  // OPTIMIZATION: Only show the selected (first) image from global entity
  const globalImages = globalEntity?.images && globalEntity.images.length > 0 ? [globalEntity.images[0]] : [];
  
  // Determine which image is currently displayed
  const displayImages = viewingGlobal ? globalImages : currentImages;
  const currentDisplayImage = displayImages[selectedImageIndex];

  const handleDeleteImage = (index: number) => {
      // Prevent deleting global images from episode view
      if (viewingGlobal) return;

      onShowDialog("确定删除这张图片吗？", () => {
          const newImages = currentImages.filter((_, i) => i !== index);
          onUpdate(entity.id, 'images', newImages);
          if (selectedImageIndex >= newImages.length) {
            setSelectedImageIndex(Math.max(0, newImages.length - 1));
          }
      });
  };

  const handleSetAsCover = () => {
      // Prevent setting global image as cover for episode entity directly (unless we copy it, but let's stick to current entity logic for now)
      if (viewingGlobal || selectedImageIndex === 0 || !currentImages[selectedImageIndex]) return;
      
      const newImages = [...currentImages];
      const selected = newImages.splice(selectedImageIndex, 1)[0];
      newImages.unshift(selected);
      onUpdate(entity.id, 'images', newImages);
      setSelectedImageIndex(0);
  };

  const renderVisuals = () => {
      return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 1. Main Image Display (Expanded) */}
            <div className="flex-1 relative group overflow-hidden flex items-center justify-center p-4 bg-slate-100/50 min-h-0">
                {currentDisplayImage ? (
                    <img 
                      src={currentDisplayImage} 
                      alt={entity.name} 
                      className="w-full h-full object-contain drop-shadow-sm transition-all duration-300" 
                      onClick={() => onPreviewImage(currentDisplayImage)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300">
                        {entity.isGeneratingImage ? (
                             <div className="flex flex-col items-center animate-pulse">
                                <RefreshCw className="h-10 w-10 animate-spin mb-3 text-indigo-500" />
                                <span className="text-sm font-medium text-indigo-600">
                                    AI 正在绘图...
                                </span>
                            </div>
                        ) : (
                            <>
                                <ImageIcon className="h-16 w-16 mb-3 opacity-20" />
                                <span className="text-sm opacity-60">暂无图片</span>
                            </>
                        )}
                    </div>
                )}
                
                {/* Delete Button (Overlay) - Only for current entity images */}
                {currentDisplayImage && !viewingGlobal && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteImage(selectedImageIndex); }}
                        className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100"
                        title="删除这张图片"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}

                {/* Badge indicating source */}
                {viewingGlobal && (
                    <div className="absolute top-4 left-4 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md font-medium border border-indigo-200 shadow-sm">
                        整体设定参考
                    </div>
                )}
            </div>

            {/* 2. Settings Panels (Scrollable if needed, keeps buttons fixed below) */}
            <div className="bg-white border-t border-slate-200 p-4 flex flex-col gap-4 overflow-y-auto flex-shrink-0 max-h-[300px]">
                
                {/* Section A: Global Settings (If exists) */}
                {globalEntity && (
                    <div className="flex flex-col gap-2">
                        <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                            整体设定
                            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 rounded">不可编辑</span>
                        </h3>
                        <div className="flex gap-2 overflow-x-auto pb-1 min-h-[50px] scrollbar-thin scrollbar-thumb-slate-200">
                             {globalImages.length > 0 ? globalImages.map((img, idx) => (
                                <div
                                    key={`global-${idx}`}
                                    onClick={() => {
                                        setViewingGlobal(true);
                                        setSelectedImageIndex(idx);
                                    }}
                                    className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border-2 transition-all ${
                                        viewingGlobal && selectedImageIndex === idx 
                                        ? 'border-indigo-600 ring-2 ring-indigo-50' 
                                        : 'border-slate-100 hover:border-indigo-200 opacity-80 hover:opacity-100'
                                    }`}
                                >
                                    <img src={img} className="w-full h-full object-cover" alt={`global-thumb-${idx}`} />
                                </div>
                             )) : (
                                 <div className="w-full h-12 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-400 bg-slate-50">
                                     暂无整体参考图
                                 </div>
                             )}
                        </div>
                    </div>
                )}

                {/* Section B: Episode/Current Settings */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between h-8">
                        <h3 className="font-bold text-slate-800 text-xs flex items-center">
                            {globalEntity ? '分集设定' : '整体设定'}
                        </h3>
                        
                        {/* Add Button */}
                        {entity.visualPrompt && !entity.isGeneratingImage && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onGenerateImage(entity.id, model); }}
                                className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition-colors font-medium border border-indigo-200 shadow-sm"
                            >
                                <Plus className="w-3 h-3" />
                                新增生成
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 min-h-[60px] scrollbar-thin scrollbar-thumb-slate-200">
                         {currentImages.length > 0 ? currentImages.map((img, idx) => (
                            <div
                                key={`current-${idx}`}
                                onClick={() => {
                                    setViewingGlobal(false);
                                    setSelectedImageIndex(idx);
                                }}
                                className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border-2 transition-all ${
                                    !viewingGlobal && selectedImageIndex === idx 
                                    ? 'border-indigo-600 ring-2 ring-indigo-50' 
                                    : 'border-slate-100 hover:border-indigo-200'
                                }`}
                            >
                                <img src={img} className="w-full h-full object-cover" alt={`thumb-${idx}`} />
                            </div>
                         )) : (
                             <div className="w-full h-14 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400 bg-slate-50">
                                 暂无图片
                             </div>
                         )}
                         
                         {entity.isGeneratingImage && (
                            <div className="w-14 h-14 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            </div>
                         )}
                    </div>
                </div>
            </div>

             {/* Action Button - Fixed at bottom */}
            {!viewingGlobal && currentImages.length > 0 && (
                <div className="bg-white border-t border-slate-100 p-4 flex justify-center flex-shrink-0">
                    <button
                        onClick={handleSetAsCover}
                        className="w-[180px] h-[50px] rounded-lg text-sm font-bold transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] flex items-center justify-center"
                    >
                        {type === 'character' ? '选定角色图' : '选定场景图'}
                    </button>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row">
      {/* Left Column: Image Area */}
      <div className="w-full md:w-1/3 lg:w-2/5 h-80 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 bg-slate-100">
         {renderVisuals()}
      </div>

      {/* Right Column: Content Form */}
      <div className="w-full md:w-2/3 lg:w-3/5 flex flex-col h-full bg-white flex-1 overflow-hidden">
        {/* Added flex-col to scroll container so flex-1 children work properly */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 flex flex-col">
          {/* Name Input */}
          <div>
            <label className="block text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">名称</label>
            <input
              type="text"
              value={entity.name}
              onChange={(e) => onUpdate(entity.id, 'name', e.target.value)}
              className="w-full text-2xl lg:text-4xl font-bold text-slate-900 border-b border-slate-200 focus:border-indigo-500 focus:outline-none bg-transparent py-2 placeholder-slate-300 transition-colors"
              placeholder={`${type === 'character' ? '角色' : '场景'}名称`}
            />
          </div>

          {/* Role/Location Input (Full Width) */}
          <div>
            <label className="block text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">{roleLabel}</label>
            <input
              type="text"
              value={roleOrLocation}
              onChange={(e) => onUpdate(entity.id, type === 'character' ? 'role' : 'location', e.target.value)}
              className="w-full text-base lg:text-lg text-slate-700 border-b border-slate-200 focus:border-indigo-500 focus:outline-none bg-transparent py-2 transition-colors"
              placeholder="简短描述..."
            />
          </div>

           {/* Setting Input (Full Width - Only for Characters) */}
           {type === 'character' && (
            <div>
              <label className="block text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">背景设定</label>
              <textarea
                value={(entity as Character).setting}
                onChange={(e) => onUpdate(entity.id, 'setting', e.target.value)}
                rows={2}
                className="w-full text-sm lg:text-base text-slate-700 border-b border-slate-200 focus:border-indigo-500 focus:outline-none bg-transparent py-2 resize-none leading-relaxed transition-colors"
                placeholder="角色的背景故事或设定..."
              />
            </div>
          )}

          {/* Traits (Expanded Area) */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <label className="block text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">特征与描述</label>
            <textarea
              value={entity.traits}
              onChange={(e) => onUpdate(entity.id, 'traits', e.target.value)}
              className="w-full h-full flex-1 text-sm lg:text-base text-slate-600 border rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50 p-4 leading-relaxed transition-colors resize-none"
              placeholder="详细的角色特征或场景描述..."
            />
          </div>
        </div>

        {/* Visual Prompt Section (Fixed Bottom Area) */}
        <div className="p-4 md:p-6 lg:p-8 pt-4 border-t border-slate-100 bg-white z-10 flex-shrink-0">
           <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                  <label className="text-xs lg:text-sm font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                    视觉提示词
                  </label>
                  <div className="flex items-center gap-1.5 ml-2">
                        <select 
                            value={model} 
                            onChange={(e) => setModel(e.target.value)}
                            className="text-xs border border-indigo-100 bg-indigo-50 text-indigo-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium hover:bg-indigo-100 transition-colors"
                        >
                            <option value="Doubao-Seedream-4.0">Doubao-Seedream-4.0</option>
                            <option value="Doubao-Seedream-3.0">Doubao-Seedream-3.0</option>
                        </select>
                  </div>
              </div>
              <button 
                onClick={() => onGeneratePrompt(entity.id)}
                disabled={entity.isGeneratingPrompt}
                className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors uppercase font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {entity.isGeneratingPrompt ? (
                   <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                   <Wand2 className="w-3 h-3" />
                )}
                {entity.isGeneratingPrompt ? '生成中...' : (entity.visualPrompt ? '优化提示词' : '自动撰写')}
              </button>
           </div>
           <textarea
            value={entity.visualPrompt}
            onChange={(e) => onUpdate(entity.id, 'visualPrompt', e.target.value)}
            placeholder="点击上方按钮生成详细的 AI 绘画提示词，或手动输入..."
            className="w-full h-24 md:h-32 lg:h-40 text-xs lg:text-sm font-mono text-slate-600 border rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50 p-4 resize-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
