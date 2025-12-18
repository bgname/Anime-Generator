import React, { useState, useEffect } from 'react';
import { Character, Scene } from '../types';
import { Wand2, Image as ImageIcon, RefreshCw, Loader2, Plus, Trash2 } from 'lucide-react';

interface EntityCardProps {
  entity: Character | Scene;
  type: 'character' | 'scene';
  onUpdate: (id: string, field: string, value: any) => void;
  onGeneratePrompt: (id: string) => void;
  onGenerateImage: (id: string) => void;
  onShowDialog: (message: string, onConfirm: () => void) => void;
  onPreviewImage: (url: string) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ 
  entity, 
  type, 
  onUpdate, 
  onGeneratePrompt,
  onGenerateImage,
  onShowDialog,
  onPreviewImage
}) => {
  // For scenes, we use the gallery logic
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Reset selected image when entity changes
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [entity.id]);

  // Helper to safely access properties
  const roleOrLocation = type === 'character' ? (entity as Character).role : (entity as Scene).location;
  const roleLabel = type === 'character' ? '角色定位' : '地点';
  
  const images = entity.images || [];

  const handleDeleteImage = (index: number) => {
      onShowDialog("确定删除这张图片吗？", () => {
          const newImages = images.filter((_, i) => i !== index);
          
          if (type === 'character') {
             // For character, we replace with empty string to maintain slot structure if needed
             const updated = [...images];
             updated[index] = ""; 
             onUpdate(entity.id, 'images', updated);
          } else {
             onUpdate(entity.id, 'images', newImages);
             if (selectedImageIndex >= newImages.length) {
                setSelectedImageIndex(Math.max(0, newImages.length - 1));
             }
          }
      });
  };


  const renderCharacterVisuals = () => {
     // Expect images[0]=Front, images[1]=Side, images[2]=Back
     const labels = ['正视图', '侧视图', '背视图'];
     
     return (
        <div className="flex flex-col h-full bg-slate-100">
           {/* Header */}
           <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
              <span className="font-bold text-slate-700">角色三视图</span>
              {entity.visualPrompt && !entity.isGeneratingImage && (
                 <button 
                    onClick={() => onGenerateImage(entity.id)}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full transition-colors"
                 >
                    <Wand2 className="w-3 h-3" />
                    生成图片
                 </button>
              )}
           </div>
           
           {/* Grid */}
           <div className="flex-1 p-4 overflow-y-auto">
             {entity.isGeneratingImage ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                   <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                   <p className="text-slate-500 text-sm">正在绘制三视图...</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 gap-4 h-full">
                   {labels.map((label, idx) => {
                      const imgUrl = images[idx];
                      return (
                        <div key={idx} className="flex-1 bg-white rounded-lg border border-slate-200 p-2 flex flex-col relative group">
                           <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">{label}</div>
                           <div className="flex-1 bg-slate-50 rounded border border-slate-100 flex items-center justify-center overflow-hidden relative">
                              {imgUrl ? (
                                 <img 
                                    src={imgUrl} 
                                    className="w-full h-full object-contain cursor-pointer transition-transform hover:scale-[1.02]" 
                                    alt={label} 
                                    onClick={() => onPreviewImage(imgUrl)}
                                 />
                              ) : (
                                 <ImageIcon className="w-8 h-8 text-slate-300 opacity-50" />
                              )}
                           </div>
                           
                           {/* Delete specific view */}
                           {imgUrl && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                           )}
                        </div>
                      );
                   })}
                </div>
             )}
           </div>
        </div>
     );
  };

  const renderSceneVisuals = () => {
      const currentImage = images[selectedImageIndex];
      return (
        <div className="flex flex-col h-full">
            {/* Main Image Display */}
            <div className="flex-1 relative group bg-slate-50 overflow-hidden flex items-center justify-center">
                {currentImage ? (
                    <img 
                      src={currentImage} 
                      alt={entity.name} 
                      className="w-full h-full object-contain cursor-pointer" 
                      onClick={() => onPreviewImage(currentImage)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                        {entity.isGeneratingImage ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <RefreshCw className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
                                <span className="text-sm font-medium text-indigo-600">生成中...</span>
                            </div>
                        ) : (
                            <>
                                <ImageIcon className="h-12 w-12 lg:h-20 lg:w-20 mb-2 opacity-20" />
                                <span className="text-sm lg:text-base opacity-50">暂无图片</span>
                            </>
                        )}
                    </div>
                )}

                {/* Top Right Action: Delete current image */}
                {currentImage && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteImage(selectedImageIndex); }}
                        className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-full shadow-sm backdrop-blur transition-all opacity-0 group-hover:opacity-100"
                        title="删除当前图片"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}

                {/* Bottom Overlay: Generate Button (If no images) or Add Button */}
                <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {entity.visualPrompt && !entity.isGeneratingImage && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onGenerateImage(entity.id); }}
                            className="bg-white/90 backdrop-blur-sm text-indigo-600 py-2.5 px-6 rounded-xl shadow-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-white border border-indigo-100 transition-all hover:scale-105"
                        >
                            {images.length > 0 ? (
                                <>
                                    <Plus className="w-4 h-4" />
                                    新增生成
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4" />
                                    生成图片
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Thumbnails Strip */}
            {images.length > 0 && (
                <div className="h-24 bg-white border-t border-slate-200 p-3 overflow-x-auto whitespace-nowrap flex gap-2 items-center">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedImageIndex(idx)}
                            className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${selectedImageIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
                        >
                            <img src={img} className="w-full h-full object-cover" />
                        </button>
                    ))}
                    
                    {/* Loader placeholder in strip if generating */}
                    {entity.isGeneratingImage && (
                        <div className="w-16 h-16 rounded-md bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                        </div>
                    )}
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="w-full h-full flex flex-row">
      {/* Left Column: Image Area */}
      <div className="w-1/3 lg:w-2/5 flex flex-col border-r border-slate-200 flex-shrink-0 bg-slate-100">
         {type === 'character' ? renderCharacterVisuals() : renderSceneVisuals()}
      </div>

      {/* Right Column: Content Form */}
      <div className="w-2/3 lg:w-3/5 flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
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
          <div className="flex-1 flex flex-col">
            <label className="block text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">特征与描述</label>
            <textarea
              value={entity.traits}
              onChange={(e) => onUpdate(entity.id, 'traits', e.target.value)}
              className="w-full min-h-[150px] flex-1 text-sm lg:text-base text-slate-600 border rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50 p-4 leading-relaxed transition-all"
              placeholder="详细的角色特征或场景描述..."
            />
          </div>
        </div>

        {/* Visual Prompt Section (Fixed Bottom Area) */}
        <div className="p-6 lg:p-8 pt-4 border-t border-slate-100 bg-white z-10">
           <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                  <label className="text-xs lg:text-sm font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                    视觉提示词
                  </label>
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
            className="w-full h-32 lg:h-40 text-xs lg:text-sm font-mono text-slate-600 border rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50 p-4 resize-none transition-all"
          />
        </div>
      </div>
    </div>
  );
};