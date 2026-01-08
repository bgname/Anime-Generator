
export interface OverallStyle {
  name: string;
  content: string;
  paintingStyle: string;
  referenceImageId?: string;
  referenceImageName?: string;
  characterRatio?: string;
  sceneRatio?: string;
  shotRatio?: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  setting: string;
  traits: string;
  visualPrompt: string;
  images: string[];
  isGeneratingImage?: boolean;
  isGeneratingPrompt?: boolean;
  episode?: number; // Added episode number
}

export interface Scene {
  id: string;
  name: string;
  location: string;
  traits: string;
  visualPrompt: string;
  images: string[];
  isGeneratingImage?: boolean;
  isGeneratingPrompt?: boolean;
  episode?: number; // Added episode number
}

// Added EpisodeInfo interface to fix the import error in EpisodeInfoCard.tsx
export interface EpisodeInfo {
  title: string;
  targetDuration: string;
  summary: string;
  optimizationSuggestions: string;
}

export interface Shot {
  id: string;
  episode: number;
  shotNumber: number;
  description: string; // Narrative description
  visualPrompt: string; // AI Prompt
  image?: string; // Generated image
  camera?: string; // e.g. "Close-up", "Pan left"
  audio?: string; // Dialogue or SFX
  duration?: string; // e.g. "3s"
  isGeneratingImage?: boolean;
  isGeneratingPrompt?: boolean;
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  type: 'character' | 'scene' | 'shot';
  name: string;
  roleOrLocation: string;
  description: string;
  traits: string;
  prompt: string;
  images: string[];
}

export interface ProjectState {
  projectName?: string; // Added project name
  step: number;
  script: string;
  style: OverallStyle;
  characters: Character[];
  scenes: Scene[];
  shots: Shot[]; // Added shots list
  isAnalyzing: boolean;
  isExtractingGlobal?: boolean; // New flag for async global extraction
  cozeApiKey: string;
  history: GenerationHistoryItem[];
  // Non-serializable directory handle
  workspaceHandle?: any; 
  episodeCount?: number; // Track total episodes
  episodeStatus?: Record<number, 'pending' | 'loading' | 'done'>; // Track status per episode
  storyboardStatus?: Record<number, 'pending' | 'loading' | 'done'>; // Track storyboard generation per episode
}

export enum AppStep {
  INPUT_SCRIPT = 0,
  OVERALL_STYLE = 1,
  GLOBAL_ROLES = 2,
  EPISODE_SETTINGS = 3,
  STORYBOARD = 4 // Added Storyboard step
}
