
import { GenerationHistoryItem } from '../types';

/**
 * Saves a history item directly to a local folder handle.
 */
export const saveToWorkspace = async (
  handle: any, // FileSystemDirectoryHandle
  item: GenerationHistoryItem
) => {
  try {
    const timestampStr = new Date(item.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const folderName = `${item.name}_${timestampStr}`;
    
    // Create sub-folder in workspace
    const subFolderHandle = await handle.getDirectoryHandle(folderName, { create: true });
    
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

      const base64Data = imgData.split(',')[1];
      if (base64Data) {
        const fileName = `视图_${i + 1}.png`;
        const fileHandle = await subFolderHandle.getFileHandle(fileName, { create: true });
        const writableImg = await fileHandle.createWritable();
        
        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        await writableImg.write(blob);
        await writableImg.close();
      }
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
