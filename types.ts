
export interface OverallStyle {
  name: string;
  content: string;
  paintingStyle: string;
  referenceImageId?: string;
  referenceImageName?: string;
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
}

// Added EpisodeInfo interface to fix the import error in EpisodeInfoCard.tsx
export interface EpisodeInfo {
  title: string;
  targetDuration: string;
  summary: string;
  optimizationSuggestions: string;
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  type: 'character' | 'scene';
  name: string;
  roleOrLocation: string;
  description: string;
  traits: string;
  prompt: string;
  images: string[];
}

export interface ProjectState {
  step: number;
  script: string;
  style: OverallStyle;
  characters: Character[];
  scenes: Scene[];
  isAnalyzing: boolean;
  cozeApiKey: string;
  history: GenerationHistoryItem[];
  // Non-serializable directory handle
  workspaceHandle?: any; 
}

export enum AppStep {
  INPUT_SCRIPT = 0,
  OVERALL_STYLE = 1,
  CHARACTERS_SCENES = 2
}
