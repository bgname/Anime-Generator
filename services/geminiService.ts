
import { GoogleGenAI } from "@google/genai";
import { Character, Scene, OverallStyle, Shot } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Coze API Configuration
const COZE_WORKFLOW_ID_STYLE = '7582884589447151643';
const COZE_WORKFLOW_ID_ENTITIES = '7582889307032272930';
const COZE_WORKFLOW_ID_CHARACTER_PROMPT = '7586528499697451062';
const COZE_WORKFLOW_ID_SCENE_PROMPT = '7584007850298228799';
const COZE_WORKFLOW_ID_CHARACTER_IMAGE_GEN = '7586599921504010283';
const COZE_WORKFLOW_ID_SCENE_IMAGE_GEN = '7586599921504010283';

// New Workflows
const COZE_WORKFLOW_ID_SPLIT_EPISODES = '7587359364898947124';
const COZE_WORKFLOW_ID_EXTRACT_EPISODE_ENTITIES = '7587626459273068553';
const COZE_WORKFLOW_ID_EXTRACT_EPISODE_SCENES = '7587731183036792868';
const COZE_WORKFLOW_ID_EXTRACT_STORYBOARD = '7587239418848346138'; // Updated ID

export const uploadFileToCoze = async (file: File, apiKey: string): Promise<{ id: string, name: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://api.coze.cn/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(result.msg || "文件上传失败");
  }

  return {
    id: result.data.id,
    name: result.data.file_name
  };
};

export const uploadImageFromUrl = async (url: string, apiKey: string): Promise<{ id: string, name: string }> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        let ext = 'png';
        let mimeType = blob.type;

        // Strict extension mapping for Coze
        if (mimeType === 'image/jpeg') ext = 'jpg';
        else if (mimeType === 'image/png') ext = 'png';
        else if (mimeType === 'image/webp') ext = 'webp';
        else if (mimeType === 'image/gif') ext = 'gif';
        else {
            // Fallback detection from URL
            const urlLower = url.toLowerCase();
            if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
                ext = 'jpg';
                mimeType = 'image/jpeg';
            } else if (urlLower.endsWith('.png')) {
                ext = 'png';
                mimeType = 'image/png';
            } else if (urlLower.endsWith('.webp')) {
                ext = 'webp';
                mimeType = 'image/webp';
            }
        }

        const filename = `ref_upload_${Date.now()}.${ext}`;
        // Ensure we provide a valid mime type if original was missing
        const file = new File([blob], filename, { type: mimeType || 'image/png' });
        return await uploadFileToCoze(file, apiKey);
    } catch (e) {
        console.error("Upload image from URL failed", e);
        throw e;
    }
};

// Helper to stream Coze workflow
async function runCozeWorkflow(workflowId: string, parameters: Record<string, any>, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error("请先在设置中配置 Coze API Key");
  }

  // Debug logging for request
  console.log(`%c[COZE API DEBUG] Requesting Workflow: ${workflowId}`, "color: #6366f1; font-weight: bold;");
  console.log("%c[COZE API DEBUG] Parameters:", "color: #6366f1;", parameters);

  const response = await fetch('https://api.coze.cn/v1/workflow/stream_run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      parameters: parameters
    })
  });

  if (!response.body) {
    throw new Error("Coze API response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let contentJsonString = '';

  const processLine = (line: string) => {
      if (line.trim().startsWith('data:')) {
        try {
          const dataStr = line.trim().substring(5).trim();
          if (!dataStr) return;
          
          const data = JSON.parse(dataStr);
          // Check for the End node content
          if (data.node_type === 'End' && data.content) {
            contentJsonString = data.content;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
  };

  while (true) {
    const { done, value } = await reader.read();
    
    if (value) {
        buffer += decoder.decode(value, { stream: true });
    }

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last partial line in buffer

    for (const line of lines) {
        processLine(line);
    }

    if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
            processLine(buffer);
        }
        break;
    }
  }

  if (!contentJsonString) {
      console.error("%c[COZE API DEBUG] Error: No content returned from End node", "color: #ef4444; font-weight: bold;");
      // Fallback: If no content found, throw error to trigger retry logic or UI error
      throw new Error("Failed to retrieve content from Coze workflow.");
  }
  
  // Debug logging for response
  console.log(`%c[COZE API DEBUG] Response from Workflow ${workflowId}:`, "color: #10b981; font-weight: bold;");
  // Limit log size
  const logContent = contentJsonString.length > 500 ? contentJsonString.substring(0, 500) + '...' : contentJsonString;
  console.log("%c" + logContent, "color: #10b981; font-family: monospace;");

  return contentJsonString;
}

// Helper: Deep recursively find a key in an object
function deepFind(obj: any, keys: string[]): any {
    if (!obj || typeof obj !== 'object') return undefined;
    
    // Check current level
    for (const k of Object.keys(obj)) {
        if (keys.includes(k) || keys.includes(k.toLowerCase())) {
            return obj[k];
        }
    }
    
    // Recursive search
    for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'object') {
            const found = deepFind(obj[k], keys);
            if (found !== undefined) return found;
        }
        // Handle cases where nested JSON is stringified
        if (typeof obj[k] === 'string' && (obj[k].trim().startsWith('{') || obj[k].trim().startsWith('['))) {
            try {
                const parsed = JSON.parse(obj[k]);
                const found = deepFind(parsed, keys);
                if (found !== undefined) return found;
            } catch(e) {}
        }
    }
    return undefined;
}

/**
 * Robust JSON Parser
 */
function safeJsonParse(input: string): any {
    if (!input) return null;
    if (typeof input === 'object') return input;
    
    let cleaned = input.trim();

    // 1. Remove Markdown wrappers
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    // 2. Extract JSON substring (first { or [ to last } or ])
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
    else if (firstBrace !== -1) start = firstBrace;
    else if (firstBracket !== -1) start = firstBracket;

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);

    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1);
    } else {
        // Fallback: simple parse attempt (might contain garbage but try anyway)
        try { return JSON.parse(cleaned); } catch(e) { /* continue to repairs */ }
    }

    // 3. Try clean parse first
    try { return JSON.parse(cleaned); } catch (e) {}

    // 4. Aggressive Repairs
    
    // Fix: Remove comments (// or /* */)
    cleaned = cleaned.replace(/^\s*\/\/.*$/gm, ''); 
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Fix: Leading/Trailing commas
    // Remove trailing comma from array or object
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); 

    // Fix: Single quotes for keys: {'key': -> "key":
    cleaned = cleaned.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');

    // Fix: Unquoted keys { key: "value" } -> { "key": "value" }
    // We strictly match alphanumeric + underscore + chinese chars to assume they are keys
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*:/g, '$1"$2":');

    // Fix: Missing comma between objects in array: ...}, {...  -> ...}, {...
    cleaned = cleaned.replace(/}\s*{/g, '},{');
    cleaned = cleaned.replace(/]\s*\[/g, '],[');

    // Fix: Python/None/True/False
    cleaned = cleaned.replace(/: ?None/g, ': null').replace(/: ?True/g, ': true').replace(/: ?False/g, ': false');

    try { 
        return JSON.parse(cleaned); 
    } catch (e) {
        // Fallback: If it looks like an array, try to extract objects manually
        if (cleaned.startsWith('[') || cleaned.indexOf('{') > -1) {
            const objects: any[] = [];
            let braceCount = 0;
            let objStart = -1;
            let inString = false;
            let escape = false;

            for (let i = 0; i < cleaned.length; i++) {
                const char = cleaned[i];
                if (inString) {
                    if (char === '\\' && !escape) escape = true;
                    else if (char === '"' && !escape) inString = false;
                    else escape = false;
                    continue;
                }
                
                if (char === '"') { inString = true; continue; }
                
                if (char === '{') {
                    if (braceCount === 0) objStart = i;
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0 && objStart !== -1) {
                        try {
                            const snippet = cleaned.substring(objStart, i + 1);
                            // Try parsing individual object
                            try {
                                objects.push(JSON.parse(snippet));
                            } catch(innerE) {
                                // Try repairing the snippet independently
                                const repairedSnippet = snippet
                                    .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                                    .replace(/,\s*}/g, '}')
                                    .replace(/'([^']+)'\s*:/g, '"$1":'); // Fix single quotes in snippet
                                objects.push(JSON.parse(repairedSnippet));
                            }
                        } catch(parseErr) {
                           // ignore bad object
                        }
                        objStart = -1;
                    }
                }
            }
            if (objects.length > 0) return objects;
        }

        console.warn("safeJsonParse failed after repairs.", e, "Input:", input);
        throw e;
    }
}

export const splitScriptToEpisodes = async (script: string, apiKey: string): Promise<string[]> => {
    try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_SPLIT_EPISODES, { script }, apiKey);
        
        let outputStr = result;
        try {
            const parsed = safeJsonParse(result);
            if (parsed && parsed.output) outputStr = parsed.output;
        } catch(e) {}

        const episodes = outputStr.split(/[、,，\n]+/).map(s => s.trim()).filter(s => s);
        return episodes;
    } catch (error) {
        console.error("Split Episodes Error", error);
        throw error;
    }
};

export const extractEpisodeScenes = async (
    script: string,
    style: OverallStyle,
    allScenesStr: string,
    episodeNum: number,
    apiKey: string
): Promise<Partial<Scene>[]> => {
    try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_EXTRACT_EPISODE_SCENES, {
            script: script,
            style: `${style.name}\n${style.content}`,
            all_scenes: allScenesStr,
            episode: episodeNum
        }, apiKey);

        const scenes: Partial<Scene>[] = []; 
        let targetString = result;

        try {
            const parsed = safeJsonParse(result);
            if (parsed) {
                // If the parsed result is already an array of scenes, use it directly
                if (Array.isArray(parsed)) {
                    parsed.forEach((item: any) => scenes.push(mapToScene(item)));
                    return scenes;
                }
                
                if (parsed.scenes && Array.isArray(parsed.scenes)) {
                    parsed.scenes.forEach((item: any) => scenes.push(mapToScene(item)));
                    return scenes;
                }

                // If nested string
                if (parsed.scenes && typeof parsed.scenes === 'string') {
                    targetString = parsed.scenes;
                } else if (parsed.output && typeof parsed.output === 'string') {
                    targetString = parsed.output;
                }
            }
        } catch (e) {}

        // Secondary parse for nested string content
        try {
            if (targetString !== result || typeof targetString === 'string') {
                 const scenesArray = safeJsonParse(targetString);
                 if (Array.isArray(scenesArray)) {
                    scenesArray.forEach((item: any) => scenes.push(mapToScene(item)));
                 }
            }
        } catch (e) {
             console.error("Failed to parse extracted JSON array string for Scenes", e);
        }

        return scenes;

    } catch (error) {
        console.error(`Extract Episode Scenes ${episodeNum} Error`, error);
        return [];
    }
};

export const extractEpisodeEntities = async (
    script: string,
    style: OverallStyle,
    allRolesStr: string,
    episodeNum: number,
    apiKey: string
): Promise<{ characters: Partial<Character>[], scenes: Partial<Scene>[] }> => {
    try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_EXTRACT_EPISODE_ENTITIES, {
            script: script,
            style: `${style.name}\n${style.content}`,
            all_roles: allRolesStr,
            episode: episodeNum
        }, apiKey);

        const characters: Partial<Character>[] = [];
        const scenes: Partial<Scene>[] = []; 

        let targetString = result;
        let outerData;

        try {
            outerData = safeJsonParse(result);
        } catch(e) {}

        if (outerData) {
             if (Array.isArray(outerData)) {
                 outerData.forEach((item: any) => characters.push(mapToCharacter(item)));
                 return { characters, scenes };
             }

             if (outerData.roles && Array.isArray(outerData.roles)) {
                 outerData.roles.forEach((item: any) => characters.push(mapToCharacter(item)));
                 return { characters, scenes };
             }

             if (outerData.roles) targetString = typeof outerData.roles === 'string' ? outerData.roles : JSON.stringify(outerData.roles);
             else if (outerData.output) targetString = typeof outerData.output === 'string' ? outerData.output : JSON.stringify(outerData.output);
        }

        try {
            const rolesArray = safeJsonParse(targetString);
            if (Array.isArray(rolesArray)) {
                rolesArray.forEach((item: any) => {
                    characters.push(mapToCharacter(item));
                });
            }
        } catch (e) {
            console.error("Failed to parse extracted JSON array string", e);
        }

        return { characters, scenes };

    } catch (error) {
        console.error(`Extract Episode ${episodeNum} Error`, error);
        throw error;
    }
};

export const extractEpisodeStoryboard = async (
    script: string,
    style: OverallStyle,
    episodeNum: number,
    apiKey: string
): Promise<Partial<Shot>[]> => {
    try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_EXTRACT_STORYBOARD, {
            script: script,
            style: `${style.name}\n${style.content}`,
            episode: episodeNum
        }, apiKey);

        const shots: Partial<Shot>[] = [];
        let dataToParse: any = result;

        // 1. Initial Parsing
        try {
            const parsed = safeJsonParse(result);
            if (parsed) {
                if (parsed.storyboard) dataToParse = parsed.storyboard;
                else if (parsed.output) dataToParse = parsed.output;
                else dataToParse = parsed;
            }
        } catch (e) {}

        // 2. Handle nested stringified JSON
        if (typeof dataToParse === 'string') {
            const trimmed = dataToParse.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                    const nestedParse = safeJsonParse(trimmed);
                    if (nestedParse) dataToParse = nestedParse;
                } catch (e) {}
            }
        }

        // Prepare Painting Style suffix
        const styleSuffix = style.paintingStyle ? `。画风：${style.paintingStyle}` : '';

        // 3. Process Array Data (JSON Format)
        if (Array.isArray(dataToParse)) {
            dataToParse.forEach((item: any, idx: number) => {
                // Requirement: Shot number starts from 1 and increments sequentially
                const shotIndex = idx + 1;

                // Composition & Camera
                const comp = item.构图设计 || {};
                const move = item.运镜调度 || {};
                
                // Construct strings
                const compStr = typeof comp === 'string' ? comp : 
                    [comp.镜头类型, comp.视角, comp.机位].filter(Boolean).join(' ');
                
                const moveStr = typeof move === 'string' ? move :
                    [move.运动方式, move.节奏轨迹].filter(Boolean).join(' ');

                const cameraStr = [compStr, moveStr].filter(s => s).join('。');
                
                // Description
                const desc = item.画面描述 || item.description || '';

                // Append Style to Visual Prompt
                const visualPrompt = `画面内容：${desc}。构图：${compStr}。运镜：${moveStr}${styleSuffix}`;

                shots.push({
                    shotNumber: shotIndex,
                    description: desc,
                    visualPrompt: visualPrompt,
                    camera: cameraStr,
                    audio: '', // Explicitly removed as per requirement
                    duration: '' // Explicitly removed as per requirement
                });
            });
            return shots;
        }

        // 4. Process Markdown Text (Fallback)
        if (typeof dataToParse === 'string') {
            const shotRegex = /####\s*分镜\s*([0-9]+[-_][0-9]+)([\s\S]*?)(?=####|$)/g;
            let match;
            let currentIdx = 0;

            while ((match = shotRegex.exec(dataToParse)) !== null) {
                currentIdx++;
                const content = match[2];

                const descriptionMatch = content.match(/\*\*(?:画面描述|画面)\*\*[:：]\s*(.*?)(?:\n\s*\*\*|$)/s);
                const compositionMatch = content.match(/\*\*(?:构图设计|构图)\*\*[:：]\s*(.*?)(?:\n\s*\*\*|$)/s);
                const cameraMatch = content.match(/\*\*(?:运镜调度|运镜)\*\*[:：]\s*(.*?)(?:\n\s*\*\*|$)/s);
                
                const description = descriptionMatch ? descriptionMatch[1].trim() : "";
                const composition = compositionMatch ? compositionMatch[1].trim() : "";
                const cameraMovement = cameraMatch ? cameraMatch[1].trim() : "";

                const visualPrompt = `画面内容：${description}。构图：${composition}。运镜：${cameraMovement}${styleSuffix}`;
                const camera = `${composition} ${cameraMovement}`.trim();

                shots.push({
                    shotNumber: currentIdx,
                    description: description,
                    visualPrompt: visualPrompt,
                    camera: camera,
                    audio: "",
                    duration: ""
                });
            }
        }

        if (shots.length === 0) {
             console.warn("No shots extracted from content", result);
        }

        return shots;

    } catch (error) {
        console.error(`Extract Storyboard Episode ${episodeNum} Error`, error);
        return [];
    }
};

function mapToCharacter(item: any): Partial<Character> {
    return {
        name: item.name || item.姓名 || '未知',
        role: item.position || item.身份 || '配角',
        setting: item.background || item.背景 || '',
        traits: item.features || item.特征 || '',
        images: []
    };
}

function mapToScene(item: any): Partial<Scene> {
    return {
        name: item.name || item.名称 || '未知',
        location: item.location || item.地点 || '',
        traits: item.features || item.特征 || '',
        images: []
    };
}

function mapToShot(item: any, idx: number): Partial<Shot> {
    return {
        shotNumber: item.shot_number || item.index || idx + 1,
        description: item.description || item.画面描述 || '',
        visualPrompt: item.visual_prompt || item.prompt || item.提示词 || '',
        camera: item.camera || item.景别 || item.运镜 || '',
        audio: item.audio || item.sound || item.声音 || '',
        duration: item.duration || item.time || item.时长 || ''
    };
}

export const analyzeScriptStyle = async (script: string, apiKey: string): Promise<OverallStyle> => {
  try {
    const contentJsonString = await runCozeWorkflow(COZE_WORKFLOW_ID_STYLE, { script }, apiKey);

    let name = "";
    let content = "";
    let paintingStyle = "";

    try {
        const parsedOuter = safeJsonParse(contentJsonString);
        
        if (parsedOuter) {
            name = deepFind(parsedOuter, ['风格名称', 'name', 'style_name']) || "";
            paintingStyle = deepFind(parsedOuter, ['视觉画风', '画风', 'painting_style', 'visual_style', '画面风格']) || "";
            
            const rawContent = deepFind(parsedOuter, ['风格内容', 'content', 'style_content']);
            if (rawContent) {
                content = Array.isArray(rawContent) ? rawContent.join('\n') : String(rawContent);
            }

            if (!content && typeof parsedOuter === 'object') {
                 const targetObj = parsedOuter.style ? (typeof parsedOuter.style === 'string' ? safeJsonParse(parsedOuter.style) : parsedOuter.style) : parsedOuter;
                 
                 if (targetObj) {
                    const displayObj = { ...targetObj };
                    delete displayObj['风格名称'];
                    delete displayObj['视觉画风'];
                    delete displayObj['画风'];
                    delete displayObj['_rawString'];
                    content = JSON.stringify(displayObj, null, 2);
                 }
            }
        }

        if (!paintingStyle) {
            const jsonRegex = /"(?:视觉画风|画风|painting_style|visual_style)"\s*:\s*"([^"]+)"/;
            const jsonMatch = contentJsonString.match(jsonRegex);
            if (jsonMatch) {
                paintingStyle = jsonMatch[1];
            } else {
                const textRegex = /(?:^|\n|[*#-]\s*)(?:\*\*)?(?:视觉画风|画风|画面风格|美术风格)(?:\*\*)?[:：]\s*(.+?)(?:\n|$)/;
                const textMatch = contentJsonString.match(textRegex);
                if (textMatch) {
                    paintingStyle = textMatch[1].trim();
                }
            }
            if (paintingStyle && paintingStyle.includes('\\u')) {
                try { paintingStyle = JSON.parse(`"${paintingStyle}"`); } catch(e) {}
            }
        }

        if (!name) {
             const jsonRegex = /"(?:风格名称|name|style_name)"\s*:\s*"([^"]+)"/;
             const m = contentJsonString.match(jsonRegex);
             if (m) name = m[1];
             else {
                 const textRegex = /(?:^|\n|[*#-]\s*)(?:\*\*)?风格名称(?:\*\*)?[:：]\s*(.+?)(?:\n|$)/;
                 const tm = contentJsonString.match(textRegex);
                 if (tm) name = tm[1].trim();
             }
        }

        if (!content) {
             const jsonRegex = /"(?:风格内容|content|style_content)"\s*:\s*"([^"]+)"/;
             const m = contentJsonString.match(jsonRegex);
             if (m) content = m[1];
             else {
                 const textRegex = /(?:^|\n|[*#-]\s*)(?:\*\*)?风格内容(?:\*\*)?[:：]\s*([\s\S]+?)(?:\n(?=[*#-])|$)/;
                 const tm = contentJsonString.match(textRegex);
                 if (tm) content = tm[1].trim();
             }
        }

    } catch (e) {
        console.warn("Parsing style failed, using raw string", e);
        content = contentJsonString;
    }

    if (!content) content = "暂无风格描述";
    if (!name) name = "自定义风格";

    if (paintingStyle.includes('\\u')) { try { paintingStyle = JSON.parse(`"${paintingStyle}"`); } catch(e){} }
    if (name.includes('\\u')) { try { name = JSON.parse(`"${name}"`); } catch(e){} }

    return { name, content, paintingStyle: paintingStyle };

  } catch (error) {
    console.error("Coze Analysis Error", error);
    throw error;
  }
};

export const extractGlobalCharactersFromScript = async (
    script: string,
    style: OverallStyle,
    apiKey: string
): Promise<Partial<Character>[]> => {
    try {
        const charResultString = await runCozeWorkflow(COZE_WORKFLOW_ID_EXTRACT_EPISODE_ENTITIES, {
            script: script,
            style: `${style.name}\n${style.content}`
        }, apiKey);

        let characters: Partial<Character>[] = [];
        try {
            let charData = safeJsonParse(charResultString);
            let targetString = charResultString;

            if (charData) {
                 if (Array.isArray(charData)) {
                     charData.forEach((item: any) => characters.push(mapToCharacter(item)));
                     // Deduplicate immediately
                     return characters.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
                 }
                 
                 if (charData.roles && Array.isArray(charData.roles)) {
                     charData.roles.forEach((item: any) => characters.push(mapToCharacter(item)));
                     return characters.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
                 }

                 if (charData.roles) targetString = typeof charData.roles === 'string' ? charData.roles : JSON.stringify(charData.roles);
                 else if (charData.output) targetString = typeof charData.output === 'string' ? charData.output : JSON.stringify(charData.output);
            }
            
            const rolesArray = safeJsonParse(targetString);
            if (Array.isArray(rolesArray)) {
                rolesArray.forEach((item: any) => characters.push(mapToCharacter(item)));
            }
        } catch (e) {
            console.error("Global Character Extraction Parse Error", e);
        }
        // Deduplicate
        return characters.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
    } catch(e) {
        console.error("extractGlobalCharactersFromScript Error", e);
        throw e;
    }
};

export const extractGlobalScenesFromScript = async (
    script: string,
    style: OverallStyle,
    apiKey: string
): Promise<Partial<Scene>[]> => {
    try {
        const sceneResultString = await runCozeWorkflow(COZE_WORKFLOW_ID_EXTRACT_EPISODE_SCENES, {
            script: script,
            style: `${style.name}\n${style.content}`
        }, apiKey);

        let scenes: Partial<Scene>[] = [];
        try {
            let sceneData = safeJsonParse(sceneResultString);
            let targetString = sceneResultString;

            if (sceneData) {
                 if (Array.isArray(sceneData)) {
                     sceneData.forEach((item: any) => scenes.push(mapToScene(item)));
                     return scenes.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
                 }

                 if (sceneData.scenes && Array.isArray(sceneData.scenes)) {
                     sceneData.scenes.forEach((item: any) => scenes.push(mapToScene(item)));
                     return scenes.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
                 }

                 if (sceneData.scenes) targetString = typeof sceneData.scenes === 'string' ? sceneData.scenes : JSON.stringify(sceneData.scenes);
                 else if (sceneData.output) targetString = typeof sceneData.output === 'string' ? sceneData.output : JSON.stringify(sceneData.output);
            }

            const scenesArray = safeJsonParse(targetString);
            if (Array.isArray(scenesArray)) {
                 scenesArray.forEach((item: any) => scenes.push(mapToScene(item)));
            }
        } catch(e) {
            console.error("Global Scene Extraction Parse Error", e);
        }
        // Deduplicate
        return scenes.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
    } catch(e) {
        console.error("extractGlobalScenesFromScript Error", e);
        throw e;
    }
};

export const extractEntities = async (
  script: string, 
  style: OverallStyle,
  apiKey: string
): Promise<{ characters: Partial<Character>[], scenes: Partial<Scene>[] }> => {
  // Backwards compatibility wrapper using Promise.all
  try {
    const [characters, scenes] = await Promise.all([
        extractGlobalCharactersFromScript(script, style, apiKey).catch(e => []),
        extractGlobalScenesFromScript(script, style, apiKey).catch(e => [])
    ]);
    return { characters, scenes };
  } catch (error) {
    console.error("Coze Entity Extraction Error", error);
    throw error;
  }
};

export const generateDetailedPrompt = async (
  type: 'character' | 'scene',
  name: string,
  traits: string,
  style: OverallStyle,
  script: string,
  additionalInfo: any,
  apiKey: string
): Promise<string> => {
  const workflowId = type === 'character' ? COZE_WORKFLOW_ID_CHARACTER_PROMPT : COZE_WORKFLOW_ID_SCENE_PROMPT;
  
  let params: Record<string, any> = {};

  if (type === 'character') {
      params = {
        role_info: `名称: ${name}\n定位: ${additionalInfo.role || ''}\n背景: ${additionalInfo.setting || ''}\n特征: ${traits}`,
        script: script,
        style: `${style.name}\n${style.content}`,
        painting_style: style.paintingStyle || ''
      };

      if (style.referenceImageId) {
         // Pass as JSON string representing the file object as expected by Coze for image-type inputs
         params.reference_image = JSON.stringify({ file_id: style.referenceImageId });
      }
  } else {
      params = {
        scene_info: `名称: ${name}\n定位: ${additionalInfo.role || ''}\n特征: ${traits}`,
        script: script,
        style: `${style.name}\n${style.content}`,
        painting_style: style.paintingStyle || ''
      };

      if (style.referenceImageId) {
         params.reference_image = JSON.stringify({ file_id: style.referenceImageId });
      }
  }

  try {
    const result = await runCozeWorkflow(workflowId, params, apiKey);
    // Result is likely the prompt string directly or JSON
    let prompt = result;
    try {
        const parsed = safeJsonParse(result);
        if (parsed) {
             // Check for specific prompts or fallback to output/prompt
             if (parsed.role_prompt) prompt = parsed.role_prompt;
             else if (parsed.scene_prompt) prompt = parsed.scene_prompt;
             else if (parsed.output) prompt = parsed.output;
             else if (parsed.prompt) prompt = parsed.prompt;
        }
    } catch(e) {}
    
    return prompt.replace(/^["']|["']$/g, ''); // clean quotes
  } catch (error) {
    console.error("Generate Prompt Error", error);
    throw error;
  }
};

export const generateVisualAsset = async (
  prompt: string,
  style: OverallStyle,
  apiKey: string,
  width: number = 2560,
  height: number = 1440,
  specificReferenceId?: string,
  referenceFileIds?: string[]
): Promise<string[]> => {
   try {
     const params: any = {
        prompt: prompt,
        style_name: style.name,
        model: 'Doubao-Seedream-4.0',
        width: width,
        height: height
     };
     
     // Support multiple reference images
     if (referenceFileIds && referenceFileIds.length > 0) {
        params.reference_images = referenceFileIds.map(id => JSON.stringify({ file_id: id }));
     } 
     // Support legacy/single reference override
     else if (specificReferenceId) {
        params.reference_image_id = specificReferenceId;
     } 
     // Fallback to global style reference
     else if (style.referenceImageId) {
        params.reference_image_id = style.referenceImageId;
     }

     const result = await runCozeWorkflow(COZE_WORKFLOW_ID_SCENE_IMAGE_GEN, params, apiKey);
     return extractImagesFromResponse(result);
   } catch(e) {
     console.error("Generate Scene Image Error", e);
     throw e;
   }
};

export const generateCharacterViews = async (
  prompt: string,
  style: OverallStyle,
  script: string,
  apiKey: string,
  width: number = 2048,
  height: number = 2048
): Promise<string[]> => {
    try {
     const params: any = {
        prompt: prompt,
        style_name: style.name,
        model: 'Doubao-Seedream-4.0',
        width: width,
        height: height
     };
     if (style.referenceImageId) {
        params.reference_image_id = style.referenceImageId;
     }
     
     const result = await runCozeWorkflow(COZE_WORKFLOW_ID_CHARACTER_IMAGE_GEN, params, apiKey);
     return extractImagesFromResponse(result);
   } catch(e) {
     console.error("Generate Character Image Error", e);
     throw e;
   }
};

function extractImagesFromResponse(responseStr: string): string[] {
    const images: string[] = [];
    try {
        const parsed = safeJsonParse(responseStr);
        // Look for 'data', 'images', 'output' which might be array of strings or objects with 'url'
        const candidates = [parsed, parsed?.data, parsed?.images, parsed?.output];
        
        for (const c of candidates) {
            if (Array.isArray(c)) {
                c.forEach((item: any) => {
                    if (typeof item === 'string' && item.startsWith('http')) images.push(item);
                    else if (item?.url) images.push(item.url);
                });
            } else if (typeof c === 'string' && c.startsWith('http')) {
                 images.push(c);
            }
        }
        
        // Fallback regex search if JSON parsing failed to find struct
        if (images.length === 0) {
            const urlRegex = /https?:\/\/[^\s"']+/g;
            const matches = responseStr.match(urlRegex);
            if (matches) images.push(...matches);
        }

    } catch(e) {
         const urlRegex = /https?:\/\/[^\s"']+/g;
         const matches = responseStr.match(urlRegex);
         if (matches) images.push(...matches);
    }
    return [...new Set(images)]; // unique
}
