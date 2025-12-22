
import { GenerationHistoryItem, ProjectState } from '../types';

/**
 * Mock Handle for environments where File System API is blocked
 */
class VirtualDirectoryHandle {
  public name: string;
  public kind = 'directory';
  public __virtual = true;

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(name: string, options?: any) {
    return new VirtualDirectoryHandle(name);
  }

  async getFileHandle(name: string, options?: any) {
    return {
      getFile: async () => ({ text: async () => "{}" }),
      createWritable: async () => ({
        write: async (content: any) => { 
           // In virtual mode, we just log or ignore. 
           // Real persistence in restricted envs would require IndexedDB implementation, 
           // which is out of scope for a quick fix.
        },
        close: async () => {}
      })
    };
  }
}

/**
 * Helper to get or create a directory path recursively or directly.
 */
async function getDirectoryPath(rootHandle: any, pathSegments: string[]) {
    let currentHandle = rootHandle;
    for (const segment of pathSegments) {
        currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
    }
    return currentHandle;
}

/**
 * Creates a new project structure.
 * 1. Asks user to pick a parent folder.
 * 2. Creates a subfolder with projectName.
 * 3. Returns the handle to the project folder.
 */
export const createNewProject = async (projectName: string) => {
    try {
        if (typeof (window as any).showDirectoryPicker !== 'function') {
             throw new Error("FileSystemAPI_NotSupported");
        }

        const parentHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });

        // Create the project folder
        const projectHandle = await parentHandle.getDirectoryHandle(projectName, { create: true });
        
        // Create initial folder structure
        await projectHandle.getDirectoryHandle('characters', { create: true });
        await projectHandle.getDirectoryHandle('scenes', { create: true });
        await projectHandle.getDirectoryHandle('assets', { create: true }); // For misc assets

        return projectHandle;
    } catch (e) {
        const err = e as Error;
        // Handle User Cancellation
        if (err.name === 'AbortError') return null;
        
        // Handle SecurityError (iframe/cross-origin) or NotSupported
        if (err.name === 'SecurityError' || err.message === 'FileSystemAPI_NotSupported') {
            console.warn("File System Access API blocked or not supported. Falling back to virtual mode.");
            return new VirtualDirectoryHandle(projectName);
        }
        
        throw e;
    }
};

/**
 * Opens an existing project folder.
 */
export const openExistingProject = async () => {
    try {
        if (typeof (window as any).showDirectoryPicker !== 'function') {
             throw new Error("FileSystemAPI_NotSupported");
        }

        const handle = await (window as any).showDirectoryPicker({
            mode: 'readwrite'
        });
        
        return handle;
    } catch (e) {
        const err = e as Error;
        if (err.name === 'AbortError') return null;
        
        if (err.name === 'SecurityError' || err.message === 'FileSystemAPI_NotSupported') {
             alert("当前环境不支持访问本地文件（可能是因为在 iframe 中运行）。无法打开本地项目。");
             return null;
        }
        throw e;
    }
};

/**
 * Saves the entire project state to project.json
 */
export const saveProjectState = async (handle: any, state: ProjectState) => {
    if (!handle) return;
    
    // Virtual Handle - Skip saving to disk
    if (handle.__virtual) return;

    try {
        // Exclude non-serializable handle
        const { workspaceHandle, isAnalyzing, ...serializableState } = state;
        const jsonString = JSON.stringify(serializableState, null, 2);
        
        const fileHandle = await handle.getFileHandle('project.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
    } catch (e) {
        console.error("Failed to save project.json", e);
    }
};

/**
 * Loads project state from project.json
 */
export const loadProjectState = async (handle: any): Promise<Partial<ProjectState> | null> => {
    // Virtual Handle - No persistence
    if (handle.__virtual) return null;

    try {
        const fileHandle = await handle.getFileHandle('project.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
    } catch (e) {
        console.warn("No project.json found or invalid", e);
        return null;
    }
};

/**
 * Saves a generated asset (image) to the project structure.
 * Structure: /[type]s/[Name]_[ID]/[filename]
 */
export const saveEntityAsset = async (
    rootHandle: any,
    type: 'character' | 'scene',
    entityName: string,
    entityId: string,
    fileName: string,
    imgData: string // Changed param name from base64Data to imgData to reflect it could be URL
) => {
    if (!rootHandle || !imgData) return;
    
    // Virtual Handle - Skip saving
    if (rootHandle.__virtual) return;

    try {
        // Sanitize folder name
        const safeName = entityName.replace(/[\\/:*?"<>|]/g, "_");
        const folderName = `${safeName}_${entityId.slice(-6)}`; // Append short ID to avoid collisions
        
        // Get correct subfolder: characters/Name_ID or scenes/Name_ID
        const parentDir = type === 'character' ? 'characters' : 'scenes';
        const entityDirHandle = await getDirectoryPath(rootHandle, [parentDir, folderName]);
        
        // Write Image
        const fileHandle = await entityDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        
        let blob: Blob;

        // Check if it is a URL (http/https)
        if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
            try {
                const response = await fetch(imgData);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                blob = await response.blob();
            } catch (fetchErr) {
                console.error("Failed to fetch image URL for saving:", fetchErr);
                await writable.close();
                return;
            }
        } 
        // Assume Base64 or Data URI
        else {
            try {
                const cleanBase64 = imgData.includes(',') ? imgData.split(',')[1] : imgData;
                // Basic cleanup of newlines/whitespace
                const sanitizedBase64 = cleanBase64.replace(/\s/g, '');
                
                const byteCharacters = atob(sanitizedBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let j = 0; j < byteCharacters.length; j++) {
                    byteNumbers[j] = byteCharacters.charCodeAt(j);
                }
                const byteArray = new Uint8Array(byteNumbers);
                blob = new Blob([byteArray], { type: 'image/png' });
            } catch (atobErr) {
                console.error("Failed to decode base64 for saving:", atobErr);
                await writable.close();
                return;
            }
        }
        
        await writable.write(blob);
        await writable.close();

        return `${parentDir}/${folderName}/${fileName}`; 
    } catch (e) {
        console.error(`Failed to save asset for ${entityName}`, e);
    }
};

/**
 * Saves text information (profile) to the entity folder.
 */
export const saveEntityProfile = async (
    rootHandle: any,
    type: 'character' | 'scene',
    entityName: string,
    entityId: string,
    content: string
) => {
    if (!rootHandle) return;
    if (rootHandle.__virtual) return;

    try {
         const safeName = entityName.replace(/[\\/:*?"<>|]/g, "_");
         const folderName = `${safeName}_${entityId.slice(-6)}`;
         const parentDir = type === 'character' ? 'characters' : 'scenes';
         const entityDirHandle = await getDirectoryPath(rootHandle, [parentDir, folderName]);

         const fileHandle = await entityDirHandle.getFileHandle('profile.txt', { create: true });
         const writable = await fileHandle.createWritable();
         await writable.write(content);
         await writable.close();
    } catch (e) {
        console.error(`Failed to save profile for ${entityName}`, e);
    }
};

/**
 * (Legacy/Manual) Saves a history item directly to a local folder handle.
 * Kept for the "History Drawer" manual export functionality.
 */
export const saveToWorkspace = async (
  handle: any, // FileSystemDirectoryHandle
  item: GenerationHistoryItem
) => {
  if (handle.__virtual) return false;

  try {
    const timestampStr = new Date(item.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const folderName = `${item.name}_${timestampStr}`;
    
    // Create sub-folder in workspace
    // If we are in project mode, save to 'history' folder to avoid clutter
    const historyDir = await handle.getDirectoryHandle('history', { create: true });
    const subFolderHandle = await historyDir.getDirectoryHandle(folderName, { create: true });
    
    // 1. Create Info Text File
    const infoText = `【名称】\n${item.name}\n\n` +
                     `【${item.type === 'character' ? '定位' : '地点'}】\n${item.roleOrLocation}\n\n` +
                     (item.type === 'character' ? `【设定】\n${item.description}\n\n` : '') +
                     `【特征】\n${item.traits}\n\n` +
                     `【提示词】\n${item.prompt}`;
    
    const textFileHandle = await subFolderHandle.getFileHandle(`${item.type === 'character' ? '角色' : '场景'}设定.txt`, { create: true });
    const writableText = await textFileHandle.createWritable();
    await writableText.write(infoText);
    await writableText.close();

    // 2. Save Images
    for (let i = 0; i < item.images.length; i++) {
      const imgData = item.images[i];
      if (!imgData) continue;

      let blob: Blob;

      // Handle URL vs Base64 for History Save as well
      if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
          try {
            const response = await fetch(imgData);
            if (!response.ok) continue;
            blob = await response.blob();
          } catch(e) { console.error("History fetch fail", e); continue; }
      } else {
         try {
             const base64Data = imgData.includes(',') ? imgData.split(',')[1] : imgData;
             const byteCharacters = atob(base64Data);
             const byteNumbers = new Array(byteCharacters.length);
             for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
             }
             const byteArray = new Uint8Array(byteNumbers);
             blob = new Blob([byteArray], { type: 'image/png' });
         } catch(e) { console.error("History atob fail", e); continue; }
      }

      const fileName = `视图_${i + 1}.png`;
      const fileHandle = await subFolderHandle.getFileHandle(fileName, { create: true });
      const writableImg = await fileHandle.createWritable();
      
      await writableImg.write(blob);
      await writableImg.close();
    }
    
    return true;
  } catch (error) {
    console.error("Failed to save to workspace:", error);
    throw error;
  }
};

/**
 * Exports project state as a JSON file.
 */
export const exportProjectConfig = (state: any) => {
  const { isAnalyzing, workspaceHandle, ...serializableState } = state;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(serializableState, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `project_config_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};
