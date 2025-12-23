
import { GoogleGenAI } from "@google/genai";
import { Character, Scene, OverallStyle } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Coze API Configuration
const COZE_WORKFLOW_ID_STYLE = '7582884589447151643';
const COZE_WORKFLOW_ID_ENTITIES = '7582889307032272930';
const COZE_WORKFLOW_ID_CHARACTER_PROMPT = '7586528499697451062';
const COZE_WORKFLOW_ID_SCENE_PROMPT = '7584007850298228799';
// Updated Character Image Workflow ID
const COZE_WORKFLOW_ID_CHARACTER_IMAGE_GEN = '7586599921504010283';
// Updated Scene Image Workflow ID to be the same as Character as requested
const COZE_WORKFLOW_ID_SCENE_IMAGE_GEN = '7586599921504010283';

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim().startsWith('data:')) {
        try {
          const dataStr = line.trim().substring(5).trim();
          if (!dataStr) continue;
          
          const data = JSON.parse(dataStr);
          // Check for the End node content
          if (data.node_type === 'End' && data.content) {
            contentJsonString = data.content;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  if (!contentJsonString) {
      console.error("%c[COZE API DEBUG] Error: No content returned from End node", "color: #ef4444; font-weight: bold;");
      throw new Error("Failed to retrieve content from Coze workflow.");
  }
  
  // Debug logging for response
  console.log(`%c[COZE API DEBUG] Response from Workflow ${workflowId}:`, "color: #10b981; font-weight: bold;");
  console.log("%c" + contentJsonString, "color: #10b981; font-family: monospace;");

  return contentJsonString;
}

export const analyzeScriptStyle = async (script: string, apiKey: string): Promise<OverallStyle> => {
  try {
    const contentJsonString = await runCozeWorkflow(COZE_WORKFLOW_ID_STYLE, { script }, apiKey);

    let name = "自定义风格";
    let content = "";

    try {
        const parsedOuter = JSON.parse(contentJsonString);

        if (parsedOuter && parsedOuter.style) {
            let styleData = parsedOuter.style;
            if (typeof styleData === 'string') {
                try {
                     if (styleData.trim().startsWith('{')) {
                        const parsedInner = JSON.parse(styleData);
                        styleData = parsedInner;
                     }
                } catch (e) { }
            }

            if (typeof styleData === 'object' && styleData !== null) {
                if (styleData['风格名称']) {
                    name = styleData['风格名称'];
                }
                if (styleData['风格内容']) {
                    const c = styleData['风格内容'];
                    content = Array.isArray(c) ? c.join('\n') : String(c);
                }
            } 
            else if (typeof styleData === 'string') {
                const nameMatch = styleData.match(/\*\*风格名称\*\*[:：]\s*(.+?)(\n|$)/);
                if (nameMatch) name = nameMatch[1].trim();

                const contentMatch = styleData.match(/\*\*风格内容\*\*([\s\S]*)/);
                content = contentMatch ? contentMatch[1].trim() : styleData;
            }
        } else {
            content = typeof parsedOuter === 'object' ? JSON.stringify(parsedOuter, null, 2) : String(parsedOuter);
        }
    } catch (e) {
        console.warn("Parsing style failed, using raw string", e);
        content = contentJsonString;
    }

    if (!content) content = "暂无风格描述";

    return { name, content, paintingStyle: '' };

  } catch (error) {
    console.error("Coze Analysis Error", error);
    throw error;
  }
};

export const extractEntities = async (
  script: string, 
  style: OverallStyle,
  apiKey: string
): Promise<{ characters: Partial<Character>[], scenes: Partial<Scene>[] }> => {
  try {
    const contentJsonString = await runCozeWorkflow(COZE_WORKFLOW_ID_ENTITIES, {
        style: `${style.name}\n${style.content}`,
        script: script
    }, apiKey);

    const characters: Partial<Character>[] = [];
    const scenes: Partial<Scene>[] = [];

    // 1. Parse outer content
    const outerData = JSON.parse(contentJsonString);
    let roleScenesStr = outerData.role_scenes;

    if (!roleScenesStr) {
      throw new Error("No 'role_scenes' found in Coze response content.");
    }

    // 2. Parse inner role_scenes (handle if it's already an object or a string)
    let roleScenesData: any;
    if (typeof roleScenesStr === 'string') {
       // Clean markdown wrappers if any
       const cleanJson = roleScenesStr.trim().replace(/^```json\s*|```$/g, '');
       roleScenesData = JSON.parse(cleanJson);
    } else {
       roleScenesData = roleScenesStr;
    }

    // 3. Extract Characters
    if (Array.isArray(roleScenesData['角色信息'])) {
      roleScenesData['角色信息'].forEach((item: any) => {
        characters.push({
          name: item.name || item.姓名 || '未知',
          role: item.position || item.身份 || '配角',
          setting: item.background || item.背景 || '',
          traits: item.features || item.特征 || '',
          images: []
        });
      });
    }

    // 4. Extract Scenes
    if (Array.isArray(roleScenesData['场景信息'])) {
      roleScenesData['场景信息'].forEach((item: any) => {
        scenes.push({
          name: item.name || item.名称 || '未知',
          location: item.location || item.地点 || '',
          traits: item.features || item.特征 || '',
          images: []
        });
      });
    }

    // Deduplicate
    const uniqueChars = characters.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
    const uniqueScenes = scenes.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

    return { characters: uniqueChars, scenes: uniqueScenes };

  } catch (error) {
    console.error("Coze Entity Extraction Error", error);
    throw error;
  }
};

export const generateDetailedPrompt = async (
  type: 'character' | 'scene',
  entityName: string,
  entityTraits: string,
  style: OverallStyle,
  script: string,
  additionalInfo?: { role?: string, setting?: string },
  apiKey?: string
): Promise<string> => {
  if (!apiKey) throw new Error(`${type === 'character' ? '角色' : '场景'}提示词生成需要 Coze API Key`);

  const commonParams: Record<string, any> = {
    painting_style: style.paintingStyle || '',
    style: `${style.name}\n${style.content}`,
    script: script
  };

  if (style.referenceImageId) {
    commonParams.reference_image = JSON.stringify({ file_id: style.referenceImageId });
  }

  if (type === 'character') {
      const parameters: Record<string, any> = {
        ...commonParams,
        role_info: `名称: ${entityName}\n定位: ${additionalInfo?.role || ''}\n背景设定: ${additionalInfo?.setting || ''}\n特征: ${entityTraits}`,
      };
      
      try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_CHARACTER_PROMPT, parameters, apiKey);
        try {
            const parsed = JSON.parse(result);
            // Check for role_promty (based on user feedback) or role_prompty (potential variations)
            const promptContent = parsed.role_promty || parsed.role_prompty || parsed.role_prompt;
            
            if (promptContent) {
                let inner = promptContent;
                if (typeof inner === 'string') {
                    if (inner.startsWith('```json')) {
                        inner = inner.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                    } else if (inner.startsWith('```')) {
                        inner = inner.replace(/^```\s*/, '').replace(/\s*```$/, '');
                    }
                    return inner;
                }
                return typeof inner === 'object' ? JSON.stringify(inner, null, 2) : String(inner);
            }
        } catch (e) {}
        return result.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } catch (error) {
        console.error("Coze Character Prompt Error", error);
        throw error;
      }
  } else {
      // Scene Prompt Generation via Coze
      const parameters: Record<string, any> = {
          ...commonParams,
          scene_info: `名称: ${entityName}\n地点: ${additionalInfo?.role || ''}\n特征: ${entityTraits}`,
      };

      try {
          const result = await runCozeWorkflow(COZE_WORKFLOW_ID_SCENE_PROMPT, parameters, apiKey);
          try {
              const parsed = JSON.parse(result);
              if (parsed.scene_prompt) {
                  return parsed.scene_prompt;
              }
          } catch (e) {
              console.warn("Failed to parse scene_prompt from result", e);
          }
          return result;
      } catch (error) {
          console.error("Coze Scene Prompt Error", error);
          throw error;
      }
  }
};

export const generateVisualAsset = async (
  visualPrompt: string,
  style: OverallStyle,
  apiKey: string,
  model: string = 'Doubao-Seedream-4.0'
): Promise<string[]> => {
  const parameters: Record<string, any> = {
    prompt: visualPrompt,
    model: model,
    width: 2560,
    height: 1440
  };

  try {
    const result = await runCozeWorkflow(COZE_WORKFLOW_ID_SCENE_IMAGE_GEN, parameters, apiKey);
    
    let parsed: any;
    try {
        parsed = JSON.parse(result);
    } catch(e) {
         if (result.startsWith('http')) return [result.trim()];
         throw new Error("Failed to parse Coze response");
    }
    
    // 1. Handle "output" field (similar to character gen now)
    if (parsed.output) {
        // New format: output is Array ["url"]
        if (Array.isArray(parsed.output)) {
            return parsed.output.map((i: any) => String(i));
        }
        
        // Nested JSON string in output?
        if (typeof parsed.output === 'string') {
             // Check if it looks like JSON
             if (parsed.output.trim().startsWith('{') || parsed.output.trim().startsWith('[')) {
                 try {
                     const inner = JSON.parse(parsed.output);
                     if (Array.isArray(inner)) return inner;
                     if (inner.output && Array.isArray(inner.output)) return inner.output; // nested output array
                 } catch(e) {}
             }
             // It might be just a url
             if (parsed.output.startsWith('http')) return [parsed.output];
        }
    }

    // Fallbacks
    const fallbackUrl = parsed.image_url || parsed.url || parsed.image;
    if (fallbackUrl) return [fallbackUrl];

    if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data.map((d: any) => d.url || d);
    }
    
    throw new Error("Could not parse image URL from response: " + JSON.stringify(parsed));

  } catch (error) {
    console.error("Coze Scene Image Gen Error", error);
    throw error;
  }
};

export const generateCharacterViews = async (
  visualPrompt: string,
  style: OverallStyle,
  script: string,
  apiKey: string,
  model: string = 'Doubao-Seedream-4.0'
): Promise<string[]> => {
    // New Parameters for Doubao-Seedream model
    const parameters = {
        prompt: visualPrompt,
        model: model,
        width: 1920,
        height: 1080
    };

    try {
        const result = await runCozeWorkflow(COZE_WORKFLOW_ID_CHARACTER_IMAGE_GEN, parameters, apiKey);
        
        let parsed: any;
        try {
            parsed = JSON.parse(result);
        } catch(e) {
             if (result.startsWith('http')) return [result.trim()];
             throw new Error("Failed to parse Coze response");
        }
        
        // 1. Handle "output" field
        if (parsed.output) {
            // New format: output is Array ["url"]
            if (Array.isArray(parsed.output)) {
                return parsed.output.map((i: any) => String(i));
            }
            
            // Nested JSON string in output?
            if (typeof parsed.output === 'string') {
                 // Check if it looks like JSON
                 if (parsed.output.trim().startsWith('{') || parsed.output.trim().startsWith('[')) {
                     try {
                         const inner = JSON.parse(parsed.output);
                         if (Array.isArray(inner)) return inner;
                         if (inner.output && Array.isArray(inner.output)) return inner.output; // nested output array
                         // Support for legacy nested formats if needed
                     } catch(e) {}
                 }
                 // It might be just a url
                 if (parsed.output.startsWith('http')) return [parsed.output];
            }
        }
        
        // 2. Fallback: Handle common Coze keys directly
        const fallbackUrl = parsed.image_url || parsed.url || parsed.image;
        if (fallbackUrl) return [fallbackUrl];

        if (parsed.data && Array.isArray(parsed.data)) {
            return parsed.data.map((d: any) => d.url || d);
        }

        throw new Error("Could not parse image URL from response: " + JSON.stringify(parsed));

    } catch (e) {
        console.error("Character Gen Error", e);
        throw new Error("Failed to generate character image");
    }
};
