import React, { useState, useEffect, useMemo } from 'react';
import { Shot, Character, Scene } from '../types';
import { 
    Loader2, ArrowRight, Wand2, Image as ImageIcon, 
    RefreshCw, Play, Camera, ImagePlus, Check, Info, User, MapPin
} from 'lucide-react';

interface StoryboardViewProps {
  episodeCount: number;
  selectedEpisode: number;
  storyboardStatus: Record<number, 'pending' | 'loading' | 'done'>;
  shots: Shot[];
  characters: Character[];
  scenes: Scene[];
  onEpisodeChange: (episode: number) => void;
  onGenerate: (episode: number) => void;
  onUpdateShot: (id: string, field: string, value: any) => void;
  onGenerateImage: (id: string, referenceImageUrls?: string[]) => void;
  onGeneratePrompt: (id: string) => void;
  onPreviewImage: (url: string, allImages?: string[]) => void;
}

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  episodeCount,
  selectedEpisode,
  storyboardStatus,
  shots,
  characters,
  scenes,
  onEpisodeChange,
  onGenerate,
  onUpdateShot,
  onGenerateImage,
  onPreviewImage
}) => {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  
  // Multi-select state for references
  const [selectedRefItems, setSelectedRefItems] = useState<{ url: string, name: string, type: 'character' | 'scene' }[]>([]);

  // Filter shots for current episode
  const episodeShots = shots.filter(s => s.episode === selectedEpisode);
  const status = storyboardStatus[selectedEpisode] || 'pending';

  const currentShot = selectedShotId 
    ? episodeShots.find(s => s.id === selectedShotId) 
    : (episodeShots.length > 0 ? episodeShots[0] : null);

  // Build Reference Lists (Memoized)
  const refCharacters = useMemo(() => {
      const isEp1 = selectedEpisode === 1;
      const candidates = characters.filter(c => {
          // Include global characters (no episode) only for Episode 1, OR characters specifically for this episode
          return c.episode === selectedEpisode || (isEp1 && !c.episode);
      }).filter(c => c.images && c.images.length > 0);

      // Deduplicate by URL to avoid showing same image inherited from global
      const unique = new Map();
      candidates.forEach(c => {
          const url = c.images[0];
          if (!unique.has(url)) {
              unique.set(url, {
                  url: url,
                  name: c.name,
                  type: 'character' as const
              });
          }
      });
      
      return Array.from(unique.values()) as { url: string, name: string, type: 'character' }[];
  }, [characters, selectedEpisode]);

  const refScenes = useMemo(() => {
      const isEp1 = selectedEpisode === 1;
      const candidates = scenes.filter(s => {
          return s.episode === selectedEpisode || (isEp1 && !s.episode);
      }).filter(s => s.images && s.images.length > 0);

      // Deduplicate by URL
      const unique = new Map();
      candidates.forEach(s => {
          const url = s.images[0];
          if (!unique.has(url)) {
              unique.set(url, {
                  url: url,
                  name: s.name,
                  type: 'scene' as const
              });
          }
      });

      return Array.from(unique.values()) as { url: string, name: string, type: 'scene' }[];
  }, [scenes, selectedEpisode]);

  // Auto-select first shot
  useEffect(() => {
    if (!selectedShotId && episodeShots.length > 0) {
        setSelectedShotId(episodeShots[0].id);
    }
  }, [selectedEpisode, episodeShots.length]);

  // Reset reference selection when shot changes
  useEffect(() => {
      setSelectedRefItems([]);
  }, [selectedShotId]);

  const toggleSelection = (item: { url: string, name: string, type: 'character' | 'scene' }) => {
      if (!currentShot) return;

      let newSelection = [...selectedRefItems];
      const exists = newSelection.find(i => i.url === item.url);
      
      if (exists) {
          newSelection = newSelection.filter(i => i.url !== item.url);
      } else {
          newSelection.push(item);
      }
      
      setSelectedRefItems(newSelection);
      
      // Update Prompt
      updatePromptWithRefs(currentShot.visualPrompt, newSelection, currentShot.id);
  };

  const updatePromptWithRefs = (currentPrompt: string, refs: typeof selectedRefItems, shotId: string) => {
      // Remove existing ref info block to avoid duplication
      // Matches "。参考图信息：..." to end of string
      let cleanPrompt = currentPrompt.replace(/。参考图信息：.*$/, '').trim();
      
      if (refs.length > 0) {
          const infoParts = refs.map((ref, idx) => {
              const typeName = ref.type === 'character' ? '角色' : '场景';
              return `参考图${idx + 1}是${typeName}${ref.name}`;
          });
          // Append new info
          const infoStr = `。参考图信息：${infoParts.join('、')}`;
          cleanPrompt = cleanPrompt + infoStr;
      }
      
      onUpdateShot(shotId, 'visualPrompt', cleanPrompt);
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] bg-slate-100 border-t border-slate-200">
      
      {/* 1. Episode Sidebar */}
      <div className="w-24 bg-slate-50 border-r border-slate-200 flex flex-col py-4 gap-2 overflow-y-auto flex-shrink-0">
         <div className="px-3 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">剧集</div>
         {Array.from({ length: episodeCount }).map((_, i) => {
             const epNum = i + 1;
             const epStatus = storyboardStatus[epNum] || 'pending';
             return (
                <button 
                    key={epNum}
                    onClick={() => onEpisodeChange(epNum)}
                    className={`mx-2 p-2 text-xs rounded-lg transition-all flex flex-col items-center gap-1 relative overflow-hidden ${
                        selectedEpisode === epNum
                        ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    <span className="z-10 relative">第{epNum}集</span>
                    {epStatus === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-indigo-500 z-10" />}
                    {epStatus === 'done' && selectedEpisode !== epNum && <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
                </button>
             );
         })}
      </div>

      {/* 2. Shot List Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <h3 className="font-bold text-slate-800">分镜列表</h3>
              
              {status === 'pending' || (status === 'done' && episodeShots.length === 0) ? (
                 <button 
                    onClick={() => onGenerate(selectedEpisode)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                 >
                     <Wand2 className="w-4 h-4" />
                     生成本集分镜
                 </button>
              ) : status === 'loading' ? (
                  <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                  </div>
              ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
             {episodeShots.length > 0 ? (
                 <ul className="divide-y divide-slate-50">
                     {episodeShots.map((shot, idx) => (
                         <li 
                            key={shot.id}
                            onClick={() => setSelectedShotId(shot.id)}
                            className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${
                                selectedShotId === shot.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'
                            }`}
                         >
                            <div className="w-16 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400 font-bold text-xs">
                                {shot.image ? (
                                    <img src={shot.image} className="w-full h-full object-cover" alt={`Shot ${shot.shotNumber}`} />
                                ) : (
                                    <span>#{shot.shotNumber}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate mb-1">分镜 {shot.shotNumber}</p>
                                <p className="text-xs text-slate-500 truncate">{shot.description || '暂无描述'}</p>
                            </div>
                         </li>
                     ))}
                 </ul>
             ) : (
                 <div className="p-6 text-center text-slate-400 text-sm">
                     {status === 'loading' ? '正在分析剧本拆解分镜...' : '暂无分镜数据'}
                 </div>
             )}
          </div>
      </div>

      {/* 3. Detail Area */}
      <div className="flex-1 bg-slate-100 p-4 md:p-6 overflow-hidden flex flex-col">
         {currentShot ? (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                 {/* Top: Image & Key Info */}
                 <div className="flex-1 flex flex-col md:flex-row min-h-0">
                     {/* Image Display */}
                     <div className="w-full md:w-1/2 bg-slate-900 flex items-center justify-center relative group p-4">
                         {currentShot.image ? (
                             <img 
                                src={currentShot.image} 
                                alt={`Shot ${currentShot.shotNumber}`} 
                                className="max-w-full max-h-full object-contain cursor-pointer"
                                onClick={() => onPreviewImage(currentShot.image!)}
                             />
                         ) : (
                             <div className="text-slate-500 flex flex-col items-center">
                                 {currentShot.isGeneratingImage ? (
                                     <>
                                        <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
                                        <span>正在绘制...</span>
                                     </>
                                 ) : (
                                     <>
                                        <ImageIcon className="w-16 h-16 opacity-20 mb-2" />
                                        <span>暂无画面</span>
                                     </>
                                 )}
                             </div>
                         )}

                         {/* Image Generation Toolbar */}
                         <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg flex items-center gap-2">
                                <button 
                                    onClick={() => onGenerateImage(currentShot.id, selectedRefItems.map(i => i.url))}
                                    disabled={currentShot.isGeneratingImage}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-full font-bold flex items-center gap-1 transition-colors"
                                >
                                    {currentShot.image ? <RefreshCw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                    {currentShot.image ? '重新生成' : '生成画面'}
                                </button>
                             </div>
                         </div>
                     </div>
                     
                     {/* Shot Info Form */}
                     <div className="w-full md:w-1/2 p-6 overflow-y-auto space-y-6 flex flex-col">
                         <div className="flex-shrink-0">
                             <h2 className="text-xl font-bold text-slate-900 mb-1">分镜 #{currentShot.shotNumber}</h2>
                             
                             <div className="mt-3">
                                 <div className="w-full px-3 py-2 bg-slate-100 rounded text-xs text-slate-600 flex items-center gap-2 border border-slate-200">
                                     <Camera className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                     <input 
                                        value={currentShot.camera}
                                        onChange={(e) => onUpdateShot(currentShot.id, 'camera', e.target.value)}
                                        className="bg-transparent border-none p-0 w-full focus:ring-0 text-xs text-slate-700 font-medium"
                                        placeholder="构图与运镜设计"
                                     />
                                 </div>
                             </div>

                             {/* Reference Image Selector */}
                             {(refCharacters.length > 0 || refScenes.length > 0) && (
                                 <div className="mt-4 space-y-3">
                                     <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            <ImagePlus className="w-3 h-3" />
                                            绘制参考图 (多选)
                                        </label>
                                        {selectedRefItems.length > 0 && (
                                            <button 
                                                onClick={() => { setSelectedRefItems([]); updatePromptWithRefs(currentShot.visualPrompt, [], currentShot.id); }}
                                                className="text-[10px] text-slate-400 hover:text-red-500"
                                            >
                                                清空选择
                                            </button>
                                        )}
                                     </div>

                                     {/* Characters Row */}
                                     {refCharacters.length > 0 && (
                                         <div className="space-y-1">
                                             <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                 <User className="w-3 h-3" /> 角色
                                             </div>
                                             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                                 {refCharacters.map((img, idx) => (
                                                     <button
                                                         key={`char-${idx}`}
                                                         onClick={() => toggleSelection(img)}
                                                         className={`relative w-16 flex-shrink-0 group text-left`}
                                                         title={img.name}
                                                     >
                                                         <div className={`w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                                                             selectedRefItems.find(i => i.url === img.url)
                                                             ? 'border-indigo-600 ring-2 ring-indigo-100'
                                                             : 'border-slate-100 group-hover:border-indigo-200'
                                                         }`}>
                                                             <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
                                                             {selectedRefItems.find(i => i.url === img.url) && (
                                                                 <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center">
                                                                     <Check className="w-6 h-6 text-white drop-shadow-md" />
                                                                     <div className="absolute top-1 left-1 text-[10px] text-white font-bold bg-indigo-600 px-1 rounded">
                                                                         {selectedRefItems.findIndex(i => i.url === img.url) + 1}
                                                                     </div>
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <div className="text-[10px] text-slate-600 truncate mt-1 font-medium w-full text-center">
                                                             {img.name}
                                                         </div>
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     )}

                                     {/* Scenes Row */}
                                     {refScenes.length > 0 && (
                                         <div className="space-y-1">
                                             <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                 <MapPin className="w-3 h-3" /> 场景
                                             </div>
                                             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                                 {refScenes.map((img, idx) => (
                                                     <button
                                                         key={`scene-${idx}`}
                                                         onClick={() => toggleSelection(img)}
                                                         className={`relative w-16 flex-shrink-0 group text-left`}
                                                         title={img.name}
                                                     >
                                                         <div className={`w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                                                             selectedRefItems.find(i => i.url === img.url)
                                                             ? 'border-indigo-600 ring-2 ring-indigo-100'
                                                             : 'border-slate-100 group-hover:border-indigo-200'
                                                         }`}>
                                                             <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
                                                             {selectedRefItems.find(i => i.url === img.url) && (
                                                                 <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center">
                                                                     <Check className="w-6 h-6 text-white drop-shadow-md" />
                                                                     <div className="absolute top-1 left-1 text-[10px] text-white font-bold bg-indigo-600 px-1 rounded">
                                                                         {selectedRefItems.findIndex(i => i.url === img.url) + 1}
                                                                     </div>
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <div className="text-[10px] text-slate-600 truncate mt-1 font-medium w-full text-center">
                                                             {img.name}
                                                         </div>
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}
                         </div>

                         <div className="flex-1 flex flex-col min-h-0">
                             <label className="block text-sm font-bold text-slate-700 mb-2">画面描述</label>
                             <textarea 
                                value={currentShot.description}
                                onChange={(e) => onUpdateShot(currentShot.id, 'description', e.target.value)}
                                className="w-full flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
                                placeholder="描述画面内容、动作、氛围..."
                             />
                         </div>
                     </div>
                 </div>

                 {/* Bottom: Prompt Area */}
                 <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 relative">
                     <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                             <label className="text-xs font-bold text-indigo-600 uppercase tracking-wider">AI 绘画提示词</label>
                             {selectedRefItems.length > 0 && (
                                 <div className="flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-200">
                                     <Info className="w-3 h-3" />
                                     已添加 {selectedRefItems.length} 张参考图说明
                                 </div>
                             )}
                         </div>
                     </div>
                     <textarea 
                        value={currentShot.visualPrompt}
                        onChange={(e) => onUpdateShot(currentShot.id, 'visualPrompt', e.target.value)}
                        className="w-full h-20 p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                        placeholder="用于生成画面的详细提示词..."
                     />
                 </div>
             </div>
         ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-4">
                    <ArrowRight className="w-8 h-8 opacity-50" />
                 </div>
                 <p>请选择左侧分镜进行编辑</p>
             </div>
         )}
      </div>
    </div>
  );
};