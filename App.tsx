
import React, { useState, useRef, useEffect } from 'react';
// @ts-ignore
import mammoth from 'mammoth';
import { 
  ProjectState, 
  AppStep, 
  Character, 
  Scene,
  GenerationHistoryItem 
} from './types';
import { 
  analyzeScriptStyle, 
  extractEntities, 
  generateDetailedPrompt, 
  generateVisualAsset,
  generateCharacterViews,
  uploadFileToCoze
} from './services/geminiService';
import { 
  createNewProject, 
  openExistingProject, 
  saveProjectState, 
  loadProjectState, 
  saveEntityAsset, 
  saveEntityProfile 
} from './services/fileService';
import { exportProjectToPPT } from './services/pptService';
import { StepIndicator } from './components/StepIndicator';
import { LoadingOverlay } from './components/LoadingOverlay';
import { EntityCard } from './components/EntityCard';
import { CustomDialog } from './components/CustomDialog';
import { SettingsModal } from './components/SettingsModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ProjectManager } from './components/ProjectManager';
import { 
  FileText, Wand2, ArrowRight, Layout, MapPin, Users, Palette, Loader2,
  Plus, Trash2, GripVertical, Play, Pause, Settings, History, Upload, Image as ImageIcon,
  ArrowLeft, RotateCcw, AlertCircle, LogOut, Folder, AlertTriangle, FileUp, Presentation
} from 'lucide-react';

const savedKey = localStorage.getItem('coze_api_key') || '';

const INITIAL_STATE: ProjectState = {
  projectName: '',
  step: AppStep.INPUT_SCRIPT,
  script: '',
  style: { name: '', content: '', paintingStyle: '' },
  characters: [],
  scenes: [],
  isAnalyzing: false,
  cozeApiKey: savedKey,
  history: [],
};

export default function App() {
  // If workspaceHandle is null, we show ProjectManager
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<'characters' | 'scenes'>('characters');
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Loading state for project operations
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [isExportingPPT, setIsExportingPPT] = useState(false);
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'choice';
    message: string;
    onConfirm?: () => void;
    onSecondary?: () => void;
    confirmText?: string;
    secondaryText?: string;
  }>({
    isOpen: false,
    type: 'alert',
    message: '',
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const isBulkGeneratingRef = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence & Auto-Save ---

  // 1. Save API Key to localStorage only
  useEffect(() => {
    localStorage.setItem('coze_api_key', state.cozeApiKey);
  }, [state.cozeApiKey]);

  // 2. Auto-save Project State to File System
  // Debounce saving to avoid excessive file writes
  useEffect(() => {
    if (!state.workspaceHandle) return;

    const timer = setTimeout(() => {
      saveProjectState(state.workspaceHandle, state);
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timer);
  }, [
    state.script, 
    state.style, 
    state.characters, 
    state.scenes, 
    state.step,
    state.history,
    state.workspaceHandle
  ]);

  // --- Project Management Handlers ---

  const handleCreateProject = async (name: string) => {
    setIsProjectLoading(true);
    try {
      const handle = await createNewProject(name);
      if (handle) {
        // Reset state but keep API key
        setState({
          ...INITIAL_STATE,
          projectName: name,
          cozeApiKey: state.cozeApiKey, // Keep existing key
          workspaceHandle: handle
        });
        
        // Only warn once if virtual
        // @ts-ignore
        if (handle.__virtual) {
            showAlert("注意：当前环境不支持本地文件访问（如 iframe 中运行）。项目将运行在“临时模式”下，数据不会保存到本地硬盘。请在独立窗口或本地浏览器中运行以获得完整功能。");
        } else {
             // Initial save
            await saveProjectState(handle, { ...INITIAL_STATE, projectName: name });
        }
      }
    } catch (e) {
      console.error("Create project failed", e);
      showAlert("创建项目失败，请重试。");
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleOpenProject = async () => {
    setIsProjectLoading(true);
    try {
      const handle = await openExistingProject();
      if (handle) {
        const loadedData = await loadProjectState(handle);
        if (loadedData) {
            setState(prev => ({
                ...prev,
                ...loadedData,
                workspaceHandle: handle,
                cozeApiKey: prev.cozeApiKey, // Prefer local key or handle key? Let's keep local key for auth
                isAnalyzing: false
            }));
            // If project loaded has no projectName, use folder name
            if (!loadedData.projectName) {
                setState(prev => ({ ...prev, projectName: handle.name }));
            }
        } else {
            // New folder opened or invalid JSON, initialize as empty project in this folder
            setState(prev => ({
                ...INITIAL_STATE,
                projectName: handle.name,
                cozeApiKey: prev.cozeApiKey,
                workspaceHandle: handle
            }));
        }
      }
    } catch (e) {
      console.error("Open project failed", e);
      // Alert already shown in service for known errors, but fallback here
      if ((e as Error).name !== 'AbortError' && (e as Error).name !== 'SecurityError') {
         showAlert("无法打开该文件夹或读取项目配置。");
      }
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleCloseProject = () => {
    const isVirtual = state.workspaceHandle?.__virtual;
    const msg = isVirtual 
        ? "确定要关闭临时项目吗？所有数据将会丢失（临时模式不保存数据）。" 
        : "确定要关闭当前项目吗？未保存的更改可能会丢失（通常会自动保存）。";
    
    showConfirm(msg, () => {
        setState(prev => ({
            ...INITIAL_STATE,
            cozeApiKey: prev.cozeApiKey // Preserve key
        }));
    }, "确认退出");
  };

  // --- Main App Logic ---

  const handleExportPPT = async () => {
    if (state.characters.length === 0 && state.scenes.length === 0) {
        showAlert("项目中没有任何角色或场景数据，无法导出。");
        return;
    }

    setIsExportingPPT(true);
    try {
        await exportProjectToPPT(state);
    } catch (e) {
        console.error("Export PPT failed", e);
        showAlert("导出 PPT 失败，请检查数据完整性或稍后重试。");
    } finally {
        setIsExportingPPT(false);
    }
  };

  const showAlert = (message: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'alert',
      message,
      onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
    });
  };

  const showConfirm = (message: string, onConfirm: () => void, confirmText?: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      message,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const showChoice = (message: string, onConfirm: () => void, onSecondary: () => void, confirmText: string, secondaryText: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'choice',
      message,
      onConfirm: () => {
        onConfirm();
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      },
      onSecondary: () => {
        onSecondary();
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      },
      confirmText,
      secondaryText
    });
  };

  const closeDialog = () => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  };

  const addToHistory = (
    type: 'character' | 'scene',
    entity: Character | Scene,
    images: string[]
  ) => {
    const historyItem: GenerationHistoryItem = {
      id: `hist-${Date.now()}`,
      timestamp: Date.now(),
      type,
      name: entity.name,
      roleOrLocation: type === 'character' ? (entity as Character).role : (entity as Scene).location,
      description: type === 'character' ? (entity as Character).setting : '',
      traits: entity.traits,
      prompt: entity.visualPrompt,
      images: images,
    };

    setState(prev => ({
      ...prev,
      history: [...prev.history, historyItem]
    }));
  };

  const handleDeleteHistory = (id: string) => {
    showConfirm("确定要删除这条历史记录吗？", () => {
        setState(prev => ({
            ...prev,
            history: prev.history.filter(h => h.id !== id)
        }));
    });
  };

  // --- File Parsing Logic ---

  const processScriptFile = async (file: File) => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
        let text = '';
        if (file.name.match(/\.docx$/i)) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            text = result.value;
        } else if (file.name.match(/\.(txt|md)$/i)) {
            text = await file.text();
        } else if (file.name.match(/\.doc$/i)) {
             showAlert("不支持旧版 .doc 格式。请在 Word 中将其另存为 .docx 格式后上传。");
             setState(prev => ({ ...prev, isAnalyzing: false }));
             return;
        } else {
             showAlert("不支持的文件格式。请上传 .docx, .txt 或 .md 文件。");
             setState(prev => ({ ...prev, isAnalyzing: false }));
             return;
        }

        if (text) {
             setState(prev => ({ ...prev, script: text, isAnalyzing: false }));
        } else {
             showAlert("无法从文件中提取文本，文件可能为空或格式损坏。");
             setState(prev => ({ ...prev, isAnalyzing: false }));
        }
    } catch (err) {
        console.error("File parse error", err);
        showAlert("读取文件失败，请重试。");
        setState(prev => ({ ...prev, isAnalyzing: false }));
    } finally {
         // Reset file input if used
         if (scriptFileInputRef.current) {
            scriptFileInputRef.current.value = '';
        }
    }
  };

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        processScriptFile(file);
    }
  };

  // Drag and Drop Handlers
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        processScriptFile(files[0]);
    }
  };

  const handleAnalyzeStyle = async () => {
    if (!state.script.trim()) return;
    if (!state.cozeApiKey.trim()) {
      setIsSettingsOpen(true);
      showAlert("请先在设置中配置 Coze API Key");
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
      const style = await analyzeScriptStyle(state.script, state.cozeApiKey);
      setState(prev => ({
        ...prev,
        style: { ...style, paintingStyle: prev.style.paintingStyle || '' }, 
        step: AppStep.OVERALL_STYLE,
        isAnalyzing: false
      }));
    } catch (error) {
      console.error(error);
      showAlert("分析剧本风格失败。请检查您的网络连接或 API Key 设置。");
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const handleExtractEntities = async (force: boolean = false) => {
    // Basic validation before extraction
    const isStyleConfigured = state.style.paintingStyle.trim() !== '' || !!state.style.referenceImageId;
    if (!isStyleConfigured) {
      showAlert("请提供“画风描述”或“风格参考图”中的至少一项。");
      return;
    }

    if (!force && (state.characters.length > 0 || state.scenes.length > 0)) {
        showChoice(
            "检测到已有的角色或场景数据。您想重新从剧本中提取（将覆盖现有内容）还是继续使用旧数据进行编辑？",
            () => handleExtractEntities(true),
            () => setState(prev => ({ ...prev, step: AppStep.CHARACTERS_SCENES })),
            "重新生成",
            "继续编辑"
        );
        return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
      const data = await extractEntities(state.script, state.style, state.cozeApiKey);
      
      const newChars: Character[] = (data.characters || []).map((c, i) => ({
        id: `char-${i}-${Date.now()}`,
        name: c.name || '未知',
        role: c.role || '',
        setting: c.setting || '',
        traits: c.traits || '',
        visualPrompt: '',
        images: []
      }));

      const newScenes: Scene[] = (data.scenes || []).map((s, i) => ({
        id: `scene-${i}-${Date.now()}`,
        name: s.name || '未知',
        location: s.location || '',
        traits: s.traits || '',
        visualPrompt: '',
        images: []
      }));

      setState(prev => ({
        ...prev,
        characters: newChars,
        scenes: newScenes,
        step: AppStep.CHARACTERS_SCENES,
        isAnalyzing: false
      }));
      setCurrentIndex(0);
    } catch (error) {
      console.error(error);
      showAlert("提取角色和场景失败。");
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const updateEntity = (type: 'character' | 'scene', id: string, field: string, value: any) => {
    setState(prev => {
      if (type === 'character') {
        return {
          ...prev,
          characters: prev.characters.map(c => c.id === id ? { ...c, [field]: value } : c)
        };
      } else {
        return {
          ...prev,
          scenes: prev.scenes.map(s => s.id === id ? { ...s, [field]: value } : s)
        };
      }
    });
  };

  const setEntityLoading = (type: 'character' | 'scene', id: string, loadingField: 'isGeneratingImage' | 'isGeneratingPrompt', isLoading: boolean) => {
      setState(prev => {
        if (type === 'character') {
          return {
            ...prev,
            characters: prev.characters.map(c => c.id === id ? { ...c, [loadingField]: isLoading } : c)
          };
        } else {
          return {
            ...prev,
            scenes: prev.scenes.map(s => s.id === id ? { ...s, [loadingField]: isLoading } : s)
          };
        }
      });
  };

  const handleAddEntity = () => {
    const type = activeTab;
    const id = `${type === 'characters' ? 'char' : 'scene'}-${Date.now()}`;
    const newItem = type === 'characters' 
      ? { id, name: '新角色', role: '待定', setting: '', traits: '', visualPrompt: '', images: [] } as Character
      : { id, name: '新场景', location: '待定', traits: '', visualPrompt: '', images: [] } as Scene;
    
    setState(prev => ({
        ...prev,
        [type === 'characters' ? 'characters' : 'scenes']: [...prev[type === 'characters' ? 'characters' : 'scenes'], newItem]
    }));
    
    const currentList = stateRef.current[activeTab === 'characters' ? 'characters' : 'scenes'];
    setCurrentIndex(currentList.length); 
  };

  const handleDeleteEntity = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    showConfirm("确定要删除这项吗？此操作无法撤销。", () => {
        const type = activeTab;
        const listKey = type === 'characters' ? 'characters' : 'scenes';
        
        setState(prev => {
            const list = prev[listKey];
            const newList = list.filter((item: any) => item.id !== id);
            return { ...prev, [listKey]: newList };
        });

        const currentListLen = stateRef.current[listKey].length;
        if (currentIndex >= currentListLen - 1) {
            setCurrentIndex(Math.max(0, currentListLen - 2));
        }
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleListDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const listKey = activeTab === 'characters' ? 'characters' : 'scenes';
    const list = [...state[listKey]];
    const draggedItem = list[draggedIndex];
    
    list.splice(draggedIndex, 1);
    list.splice(index, 0, draggedItem as any);

    if (activeTab === 'characters') {
        setState(prev => ({ ...prev, characters: list as Character[] }));
    } else {
        setState(prev => ({ ...prev, scenes: list as Scene[] }));
    }
    
    if (currentIndex === draggedIndex) {
        setCurrentIndex(index);
    } else if (currentIndex === index) {
        setCurrentIndex(draggedIndex);
    }

    setDraggedIndex(index);
  };

  const generateEntityPrompt = async (type: 'character' | 'scene', id: string) => {
    const entity = type === 'character' 
      ? state.characters.find(c => c.id === id) 
      : state.scenes.find(s => s.id === id);

    if (!entity) return;

    setEntityLoading(type, id, 'isGeneratingPrompt', true);

    try {
       const additionalInfo = type === 'character' 
         ? { role: (entity as Character).role, setting: (entity as Character).setting }
         : { role: (entity as Scene).location };

       const prompt = await generateDetailedPrompt(
         type, 
         entity.name, 
         entity.traits, 
         state.style, 
         state.script,
         additionalInfo,
         state.cozeApiKey
       );
       updateEntity(type, id, 'visualPrompt', prompt);
       
       // Save profile text
       if (state.workspaceHandle) {
          const content = `【名称】\n${entity.name}\n\n【定位/地点】\n${additionalInfo.role}\n\n【特征】\n${entity.traits}\n\n【提示词】\n${prompt}`;
          saveEntityProfile(state.workspaceHandle, type, entity.name, id, content);
       }

    } catch (e) {
      console.error("Prompt gen failed", e);
      showAlert("生成提示词失败，请重试。");
    } finally {
      setEntityLoading(type, id, 'isGeneratingPrompt', false);
    }
  };

  const processBulkQueue = async () => {
    while (isBulkGeneratingRef.current) {
        const currentTab = activeTabRef.current;
        const type = currentTab === 'characters' ? 'character' : 'scene';
        const listKey = currentTab === 'characters' ? 'characters' : 'scenes';
        const list = stateRef.current[listKey];
        
        const candidate = list.find((item: any) => !item.visualPrompt && !item.isGeneratingPrompt);
        
        if (!candidate) {
            setIsBulkGenerating(false);
            isBulkGeneratingRef.current = false;
            break;
        }

        const id = candidate.id;
        setEntityLoading(type, id, 'isGeneratingPrompt', true);

        try {
            let additionalInfo: any = {};
            if (type === 'character') {
                const c = candidate as Character;
                additionalInfo = { role: c.role, setting: c.setting };
            } else {
                const s = candidate as Scene;
                additionalInfo = { role: s.location };
            }

            const prompt = await generateDetailedPrompt(
                type, 
                candidate.name, 
                candidate.traits, 
                stateRef.current.style,
                stateRef.current.script,
                additionalInfo,
                stateRef.current.cozeApiKey
            );
            
            setState(prev => {
               const prevList = type === 'character' ? prev.characters : prev.scenes;
               const updatedList = prevList.map(item => 
                   item.id === id ? { ...item, visualPrompt: prompt, isGeneratingPrompt: false } : item
               );
               return {
                   ...prev,
                   [listKey]: updatedList
               };
            });
            
             // Save profile text
            if (stateRef.current.workspaceHandle) {
                const content = `【名称】\n${candidate.name}\n\n【定位/地点】\n${additionalInfo.role}\n\n【特征】\n${candidate.traits}\n\n【提示词】\n${prompt}`;
                await saveEntityProfile(stateRef.current.workspaceHandle, type, candidate.name, id, content);
            }

        } catch (e) {
            console.error(`Failed to generate prompt for ${id}`, e);
            setEntityLoading(type, id, 'isGeneratingPrompt', false);
            setIsBulkGenerating(false);
            isBulkGeneratingRef.current = false;
            showAlert("批量生成过程中遇到错误，已暂停。");
            break;
        }
    }
  };

  const handleToggleBulkGenerate = () => {
      if (isBulkGenerating) {
          setIsBulkGenerating(false);
          isBulkGeneratingRef.current = false;
      } else {
          setIsBulkGenerating(true);
          isBulkGeneratingRef.current = true;
          processBulkQueue();
      }
  };

  const handleGenerateImage = async (type: 'character' | 'scene', id: string, model?: string) => {
     setEntityLoading(type, id, 'isGeneratingImage', true);

     const entity = type === 'character' ? state.characters.find(c => c.id === id) : state.scenes.find(s => s.id === id);
     if (!entity || !entity.visualPrompt) {
        setEntityLoading(type, id, 'isGeneratingImage', false);
        return;
     }

     try {
       let generatedImages: string[] = [];
       if (type === 'character') {
            generatedImages = await generateCharacterViews(
                entity.visualPrompt, 
                state.style, 
                state.script, 
                state.cozeApiKey,
                model
            );
            setState(prev => {
                const list = prev.characters;
                const updatedList = list.map(item => {
                    if (item.id === id) {
                        return {
                            ...item,
                            // Append new image to existing array (Gallery style)
                            images: [...(item.images || []), ...generatedImages],
                            isGeneratingImage: false
                        };
                    }
                    return item;
                });
                return { ...prev, characters: updatedList };
            });

            // Save Character Images
            if (state.workspaceHandle) {
                const startIdx = (entity.images || []).length;
                for (let i = 0; i < generatedImages.length; i++) {
                    const img = generatedImages[i];
                    if (img) {
                        await saveEntityAsset(state.workspaceHandle, type, entity.name, id, `image_${startIdx + i + 1}.png`, img);
                    }
                }
            }

       } else {
            const newImages = await generateVisualAsset(entity.visualPrompt, state.style, state.cozeApiKey, model);
            generatedImages = newImages;
            setState(prev => {
                const list = prev.scenes;
                const updatedList = list.map(item => {
                    if (item.id === id) {
                        return {
                            ...item,
                            images: [...(item.images || []), ...newImages],
                            isGeneratingImage: false
                        };
                    }
                    return item;
                });
                return { ...prev, scenes: updatedList };
            });

            // Save Scene Images
            if (state.workspaceHandle) {
                const startIdx = (entity.images || []).length;
                for (let i = 0; i < newImages.length; i++) {
                     const img = newImages[i];
                     if(img) {
                        await saveEntityAsset(state.workspaceHandle, type, entity.name, id, `image_${startIdx + i + 1}.png`, img);
                     }
                }
            }
       }

       addToHistory(type, entity, generatedImages);

     } catch (e) {
       console.error("Image gen failed", e);
       showAlert("图像生成失败。请确保服务可用或稍后重试。");
       setEntityLoading(type, id, 'isGeneratingImage', false);
     }
  };

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!state.cozeApiKey.trim()) {
      setIsSettingsOpen(true);
      showAlert("上传图片前请先配置 Coze API Key");
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
        const result = await uploadFileToCoze(file, state.cozeApiKey);
        setState(prev => ({
            ...prev,
            isAnalyzing: false,
            style: {
                ...prev.style,
                referenceImageId: result.id,
                referenceImageName: result.name,
                paintingStyle: '' // Mutually exclusive: clear painting style
            }
        }));
    } catch (error) {
        console.error("File upload failed", error);
        showAlert("参考图上传失败，请稍后重试。");
        setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const renderInputStep = () => (
    <div className="max-w-4xl mx-auto p-4 md:p-6 min-h-full flex flex-col justify-center">
       <div 
         className={`bg-white rounded-xl shadow-sm border p-6 md:p-8 my-4 transition-all relative ${
            isDragging 
              ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
              : 'border-slate-200'
         }`}
         onDragOver={handleFileDragOver}
         onDragLeave={handleDragLeave}
         onDrop={handleDrop}
       >
         {/* Drag Overlay */}
         {isDragging && (
           <div className="absolute inset-0 bg-indigo-50/90 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-indigo-400">
             <FileUp className="w-16 h-16 text-indigo-500 mb-4 animate-bounce" />
             <p className="text-xl font-bold text-indigo-700">释放鼠标以导入剧本</p>
             <p className="text-indigo-500 mt-2">支持 .docx, .txt, .md</p>
           </div>
         )}

         <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
               <FileText className="w-8 h-8" />
             </div>
             <div>
               <h2 className="text-xl md:text-2xl font-bold text-slate-900">导入剧本</h2>
               <p className="text-sm md:text-base text-slate-500">
                 粘贴文本或拖拽文档 (docx/txt) 到此处
               </p>
             </div>
           </div>
           
           <div>
               <button 
                  onClick={() => scriptFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 rounded-lg text-sm font-medium transition-all shadow-sm"
               >
                  <FileUp className="w-4 h-4" />
                  导入文档
               </button>
               <input 
                 type="file" 
                 ref={scriptFileInputRef} 
                 className="hidden" 
                 accept=".docx,.txt,.md" 
                 onChange={handleScriptUpload}
               />
           </div>
         </div>
         
         <textarea
           className="w-full h-60 md:h-80 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed"
           placeholder="内景 宇宙飞船 - 白天... (或直接拖拽文件到此处)"
           value={state.script}
           onChange={(e) => setState(s => ({ ...s, script: e.target.value }))}
         />

         <div className="mt-6 flex justify-end">
           <button
             onClick={handleAnalyzeStyle}
             disabled={!state.script.trim()}
             className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Wand2 className="w-5 h-5" />
             分析风格
           </button>
         </div>
       </div>
    </div>
  );

  const renderStyleStep = () => {
    const isStyleConfigured = state.style.paintingStyle.trim() !== '' || !!state.style.referenceImageId;

    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 min-h-full flex flex-col justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 my-4">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">整体设定</h2>
            <p className="text-sm md:text-base text-slate-500">确认整体视觉风格，该设定将用于生成后续角色和场景。</p>
          </div>

          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">风格名称</label>
                    <input
                      type="text"
                      value={state.style.name}
                      onChange={(e) => setState(s => ({ ...s, style: { ...s.style, name: e.target.value } }))}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-indigo-600" />
                          画风 (Painting Style) <span className="text-red-500">*</span>
                      </span>
                      {state.style.referenceImageId && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">已使用参考图</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={state.style.paintingStyle}
                      disabled={!!state.style.referenceImageId}
                      onChange={(e) => setState(s => ({ ...s, style: { ...s.style, paintingStyle: e.target.value } }))}
                      placeholder={state.style.referenceImageId ? "已锁定，若要修改请先删除下方参考图" : "例如：赛博朋克、水彩、写实..."}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg text-slate-800 transition-all ${
                        !isStyleConfigured && !state.style.referenceImageId 
                        ? 'border-amber-300 bg-amber-50/20' 
                        : 'border-slate-300'
                      } disabled:bg-slate-50 disabled:text-slate-400`}
                    />
                  </div>
              </div>

              <div className={`bg-slate-50 rounded-lg border p-6 transition-all ${
                !isStyleConfigured && !state.style.paintingStyle 
                ? 'border-amber-300 bg-amber-50/20' 
                : 'border-slate-200'
              }`}>
                  <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Upload className="w-4 h-4 text-indigo-600" />
                          风格参考图 (Reference Image) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-slate-400 italic">* 上传后将替代“画风”文本描述生效</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all w-full sm:w-auto justify-center ${
                              state.style.referenceImageId 
                              ? 'border-indigo-200 bg-indigo-50/50 text-indigo-600' 
                              : 'border-slate-300 hover:border-indigo-400 hover:bg-white text-slate-500'
                          }`}
                      >
                          <ImageIcon className="w-5 h-5" />
                          {state.style.referenceImageName || "点击上传参考图片"}
                      </button>

                      {state.style.referenceImageId && (
                          <button 
                              onClick={() => setState(s => ({ ...s, style: { ...s.style, referenceImageId: '', referenceImageName: '' } }))}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                              title="删除参考图"
                          >
                              <Trash2 className="w-5 h-5" />
                          </button>
                      )}
                  </div>
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleReferenceImageUpload} 
                  />
              </div>
              
              {!isStyleConfigured && (
                <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 p-2 rounded border border-amber-100">
                  <AlertCircle className="w-4 h-4" />
                  <span>必须填写“画风描述”或上传“风格参考图”以继续。</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">风格内容</label>
                <textarea
                  value={state.style.content}
                  onChange={(e) => setState(s => ({ ...s, style: { ...s.style, content: e.target.value } }))}
                  className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
          </div>

          <div className="mt-8 flex justify-between items-center border-t border-slate-100 pt-6">
            <button 
              onClick={() => setState(s => ({ ...s, step: AppStep.INPUT_SCRIPT }))}
              className="text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回剧本
            </button>
            <button
              onClick={() => handleExtractEntities()}
              disabled={!isStyleConfigured}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                isStyleConfigured 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {state.characters.length > 0 || state.scenes.length > 0 ? "管理角色和场景" : "生成角色和场景"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCharactersScenesStep = () => {
     const list = activeTab === 'characters' ? state.characters : state.scenes;
     const currentItem = list[currentIndex];

     return (
       <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] bg-slate-100 border-t border-slate-200">
          {/* Sidebar */}
          <div className="w-full md:w-80 h-48 md:h-full bg-white flex flex-col border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0">
             <div className="p-4 border-b border-slate-100">
               <div className="flex items-center justify-between mb-4">
                    <button 
                        onClick={() => setState(s => ({ ...s, step: AppStep.OVERALL_STYLE }))}
                        className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        返回风格设定
                    </button>
                    {(state.characters.length > 0 || state.scenes.length > 0) && (
                        <button 
                            onClick={() => handleExtractEntities(true)}
                            className="text-[10px] text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors bg-amber-50 px-1.5 py-0.5 rounded"
                            title="重新从剧本提取"
                        >
                            <RotateCcw className="w-2 h-2" />
                            重新生成
                        </button>
                    )}
               </div>

               <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                  <button 
                    onClick={() => { setActiveTab('characters'); setCurrentIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'characters' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <Users className="w-4 h-4" />
                    角色
                  </button>
                  <button 
                    onClick={() => { setActiveTab('scenes'); setCurrentIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'scenes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <MapPin className="w-4 h-4" />
                    场景
                  </button>
               </div>
               
               <div className="flex justify-between items-center">
                 <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">列表 ({list.length})</span>
                 <button 
                   onClick={handleAddEntity}
                   className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors"
                   title="新增项目"
                 >
                   <Plus className="w-4 h-4" />
                 </button>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto">
               {list.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 text-sm">
                   暂无{activeTab === 'characters' ? '角色' : '场景'}数据
                 </div>
               ) : (
                 <ul className="divide-y divide-slate-50">
                    {list.map((item, index) => (
                      <li 
                        key={item.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleListDragOver(e, index)}
                        className={`group relative ${draggedIndex === index ? 'opacity-50' : ''}`}
                      >
                         <div
                          onClick={() => setCurrentIndex(index)}
                          className={`w-full text-left pl-3 pr-10 py-3 cursor-pointer transition-colors flex items-center gap-3 relative ${
                            index === currentIndex 
                              ? 'bg-indigo-50 border-l-4 border-indigo-600' 
                              : 'hover:bg-slate-50 border-l-4 border-transparent'
                          }`}
                        >
                           <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                              <GripVertical className="w-4 h-4" />
                           </div>

                           <div className="min-w-0 flex-1">
                             <div className="flex items-center gap-2">
                               <p className={`text-sm font-medium truncate ${index === currentIndex ? 'text-indigo-900' : 'text-slate-700'}`}>
                                 {item.name}
                               </p>
                               {item.isGeneratingPrompt && (
                                 <Loader2 className="w-3 h-3 text-indigo-500 animate-spin flex-shrink-0" />
                               )}
                             </div>
                             <p className="text-xs text-slate-500 truncate mt-0.5">
                               {activeTab === 'characters' ? (item as Character).role : (item as Scene).location}
                             </p>
                           </div>

                           {(item.images && item.images.length > 0) && (
                              <div className="w-8 h-8 rounded bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                                <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                              </div>
                           )}
                        </div>

                        <button 
                             onClick={(e) => handleDeleteEntity(e, item.id)}
                             className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-200 z-20 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                             title="删除"
                           >
                              <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                 </ul>
               )}
             </div>

             <div className="p-4 border-t border-slate-200 bg-slate-50">
               <button 
                   onClick={handleToggleBulkGenerate}
                   disabled={list.length === 0 && !isBulkGenerating}
                   className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-all border
                      ${isBulkGenerating 
                        ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                        : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isBulkGenerating ? (
                    <>
                       <Pause className="w-4 h-4" />
                       暂停生成
                    </>
                  ) : (
                    <>
                       <Play className="w-4 h-4" />
                       批量生成提示词
                    </>
                  )}
                </button>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden p-2 sm:p-4 md:p-6 flex flex-col items-center bg-slate-100">
            <div className="w-full h-full shadow-lg rounded-xl overflow-hidden bg-white flex flex-col md:flex-row border border-slate-200 max-w-full md:max-w-[95%] xl:max-w-7xl">
              {currentItem ? (
                 <EntityCard 
                    key={currentItem.id}
                    type={activeTab === 'characters' ? 'character' : 'scene'}
                    entity={currentItem}
                    onUpdate={(id, field, value) => updateEntity(activeTab === 'characters' ? 'character' : 'scene', id, field, value)}
                    onGeneratePrompt={(id) => generateEntityPrompt(activeTab === 'characters' ? 'character' : 'scene', id)}
                    onGenerateImage={(id, model) => handleGenerateImage(activeTab === 'characters' ? 'character' : 'scene', id, model)}
                    onShowDialog={showConfirm}
                    onPreviewImage={(url) => setPreviewImageUrl(url)}
                  />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Layout className="w-12 h-12 mb-3 opacity-20" />
                  <p>请选择左侧列表查看详情</p>
                </div>
              )}
            </div>
          </div>
       </div>
     );
  };

  // --- Render Flow ---
  
  if (!state.workspaceHandle) {
    return (
      <ProjectManager 
        onCreate={handleCreateProject} 
        onOpen={handleOpenProject} 
        isLoading={isProjectLoading}
      />
    );
  }

  // Check if virtual
  // @ts-ignore
  const isVirtual = state.workspaceHandle?.__virtual;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <div className="absolute top-4 right-6 z-20 flex items-center gap-3">
         {/* Virtual Mode Warning */}
         {isVirtual && (
             <div className="hidden md:flex items-center gap-2 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200 text-xs text-amber-700 mr-2 shadow-sm animate-pulse">
                 <AlertTriangle className="w-3 h-3" />
                 <span>临时模式</span>
             </div>
         )}
         
         <div className="hidden md:flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-500 mr-2 backdrop-blur-sm">
             <Folder className="w-3 h-3" />
             <span className="max-w-[150px] truncate">{state.projectName || state.workspaceHandle.name}</span>
         </div>

         <button
            onClick={handleCloseProject}
            className="p-2 rounded-full bg-white text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 shadow-sm transition-all"
            title="关闭项目"
         >
            <LogOut className="w-5 h-5" />
         </button>

         <div className="w-px h-6 bg-slate-300 mx-1"></div>

         <button
            onClick={handleExportPPT}
            disabled={isExportingPPT}
            className="p-2 rounded-full bg-white text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 shadow-sm transition-all relative"
            title="导出 PPT"
         >
            {isExportingPPT ? (
               <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            ) : (
               <Presentation className="w-5 h-5" />
            )}
         </button>

         <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 rounded-full bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 shadow-sm transition-all"
            title="生成历史"
         >
            <History className="w-5 h-5" />
         </button>

         <button 
           onClick={() => setIsSettingsOpen(true)}
           className={`p-2 rounded-full transition-all border shadow-sm ${
             !state.cozeApiKey 
               ? 'bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse' 
               : 'bg-white text-slate-400 hover:text-slate-700 border-slate-200 hover:border-slate-300'
           }`}
           title="设置 API Key"
         >
            <Settings className="w-5 h-5" />
         </button>
      </div>

      <StepIndicator currentStep={state.step} />
      
      <div className={`flex-1 relative ${state.step === AppStep.CHARACTERS_SCENES ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {state.step === AppStep.INPUT_SCRIPT && renderInputStep()}
        {state.step === AppStep.OVERALL_STYLE && renderStyleStep()}
        {state.step === AppStep.CHARACTERS_SCENES && renderCharactersScenesStep()}
        
        <CustomDialog 
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          message={dialogConfig.message}
          confirmText={dialogConfig.confirmText}
          secondaryText={dialogConfig.secondaryText}
          onConfirm={dialogConfig.onConfirm}
          onSecondary={dialogConfig.onSecondary}
          onCancel={closeDialog}
        />

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          apiKey={state.cozeApiKey}
          onApiKeyChange={(key) => setState(prev => ({...prev, cozeApiKey: key}))}
        />
        
        <HistoryDrawer 
           isOpen={isHistoryOpen}
           onClose={() => setIsHistoryOpen(false)}
           history={state.history}
           workspaceHandle={state.workspaceHandle}
           onDelete={handleDeleteHistory}
           onPreviewImage={setPreviewImageUrl}
        />

        <ImagePreviewModal 
          isOpen={!!previewImageUrl}
          imageUrl={previewImageUrl || ''}
          onClose={() => setPreviewImageUrl(null)}
        />
      </div>

      {(state.isAnalyzing || isExportingPPT) && (
        <LoadingOverlay message={
            isExportingPPT 
            ? "正在生成 PPT 文件，请稍候..." 
            : (state.step === AppStep.INPUT_SCRIPT ? "正在分析视觉风格..." : "正在处理中...")
        } />
      )}
    </div>
  );
}
