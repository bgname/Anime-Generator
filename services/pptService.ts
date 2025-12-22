
import PptxGenJS from 'pptxgenjs';
import { ProjectState, Character, Scene } from '../types';

export const exportProjectToPPT = async (state: ProjectState) => {
  const pptx = new PptxGenJS();
  
  // Set Metadata
  pptx.author = '剧本可视化工具';
  pptx.company = 'Ubanquan';
  pptx.title = state.projectName || '剧本分镜项目';

  // 1. Cover Slide
  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: 'F1F5F9' }; // Slate-50
  
  coverSlide.addText(state.projectName || "剧本可视化项目", {
    x: '10%', y: '40%', w: '80%', h: 1,
    fontSize: 36, fontFace: 'Arial', color: '1E293B', bold: true, align: 'center'
  });
  
  coverSlide.addText(`生成时间: ${new Date().toLocaleDateString()}`, {
    x: '10%', y: '55%', w: '80%', h: 0.5,
    fontSize: 14, color: '64748B', align: 'center'
  });

  // 2. Character Slides
  if (state.characters.length > 0) {
    // Section Title
    const sectionSlide = pptx.addSlide();
    sectionSlide.background = { color: '4F46E5' }; // Indigo-600
    sectionSlide.addText("角色设定", {
        x: 0, y: '45%', w: '100%', h: 1,
        fontSize: 32, color: 'FFFFFF', bold: true, align: 'center'
    });

    for (const char of state.characters) {
        await addCharacterSlide(pptx, char);
    }
  }

  // 3. Scene Slides
  if (state.scenes.length > 0) {
     // Section Title
     const sectionSlide = pptx.addSlide();
     sectionSlide.background = { color: '059669' }; // Emerald-600
     sectionSlide.addText("场景设定", {
         x: 0, y: '45%', w: '100%', h: 1,
         fontSize: 32, color: 'FFFFFF', bold: true, align: 'center'
     });

     for (const scene of state.scenes) {
         await addSceneSlide(pptx, scene);
     }
  }

  // Save
  const fileName = `${state.projectName || 'Project_Export'}_${new Date().toISOString().slice(0,10)}.pptx`;
  await pptx.writeFile({ fileName });
};

// Helper to convert URL to Base64 to ensure PPTX can embed it
async function processImage(img: string): Promise<string> {
    if (!img) return '';
    if (img.startsWith('data:')) return img;
    
    // If it's a URL (http/https/blob), fetch it
    if (img.startsWith('http') || img.startsWith('blob:')) {
        try {
            const response = await fetch(img);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("PPT Image Load Failed:", img, e);
            // Fallback: Return original URL and hope pptxgenjs can handle it (might fail due to CORS)
            return '';
        }
    }
    return ''; // Unknown format
}

async function addCharacterSlide(pptx: PptxGenJS, char: Character) {
    const slide = pptx.addSlide();
    
    // Header
    slide.addText(`角色：${char.name}`, {
        x: 0.5, y: 0.3, w: '90%', h: 0.5,
        fontSize: 24, bold: true, color: '4F46E5', fontFace: 'Arial'
    });
    
    slide.addShape(pptx.ShapeType.line, { 
        x: 0.5, y: 0.9, w: '90%', h: 0, 
        line: { color: 'E2E8F0', width: 2 } 
    });

    // Info Column (Left)
    const startY = 1.2;
    const lineHeight = 0.4;
    let currentY = startY;

    const addField = (label: string, value: string) => {
        slide.addText(label, {
            x: 0.5, y: currentY, w: 1.5, h: lineHeight,
            fontSize: 12, bold: true, color: '64748B'
        });
        slide.addText(value || '无', {
            x: 2.0, y: currentY, w: 4.5, h: lineHeight,
            fontSize: 12, color: '1E293B'
        });
        currentY += lineHeight + 0.1;
    };

    addField("定位", char.role);
    addField("背景", char.setting);
    
    // Description / Traits (Multi-line)
    slide.addText("特征描述", {
        x: 0.5, y: currentY, w: 1.5, h: lineHeight,
        fontSize: 12, bold: true, color: '64748B'
    });
    slide.addText(char.traits || '无', {
        x: 0.5, y: currentY + 0.4, w: 6.0, h: 2.0,
        fontSize: 11, color: '334155', valign: 'top', wrap: true
    });

    // Images Column (Right or Bottom)
    // For characters, we often have 3 images (Front, Side, Back)
    
    const validImages = char.images.filter(img => img && img.length > 10);
    const processedImages: string[] = [];

    // Pre-process images to base64
    for (const img of validImages) {
        const base64 = await processImage(img);
        if (base64) processedImages.push(base64);
    }
    
    if (processedImages.length > 0) {
        if (processedImages.length === 1) {
             // Single Image - Large on the right
             slide.addImage({
                data: processedImages[0],
                x: 7.0, y: 1.2, w: 2.8, h: 4.0,
                sizing: { type: 'contain', w: 2.8, h: 4.0 }
             });
        } else {
             // Multiple Images - Row at the bottom
             const imgWidth = 3.0;
             const imgHeight = 3.0;
             const gap = 0.2;
             const startX = (10 - (processedImages.length * imgWidth + (processedImages.length - 1) * gap)) / 2;
             
             // Check if we need to shift text up or images down. 
             // With current layout, images go to bottom
             const imgY = 4.0; 

             processedImages.slice(0, 3).forEach((img, idx) => {
                 slide.addImage({
                     data: img,
                     x: startX + (idx * (imgWidth + gap)), 
                     y: imgY, 
                     w: imgWidth, h: imgHeight,
                     sizing: { type: 'contain', w: imgWidth, h: imgHeight }
                 });
             });
        }
    } else {
         slide.addText("（暂无生成图片）", {
            x: 7.0, y: 2.5, w: 2.5, h: 1,
            fontSize: 12, color: '94A3B8', align: 'center',
            shape: pptx.ShapeType.rect, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' }
         });
    }
}

async function addSceneSlide(pptx: PptxGenJS, scene: Scene) {
    const slide = pptx.addSlide();

    // Header
    slide.addText(`场景：${scene.name}`, {
        x: 0.5, y: 0.3, w: '90%', h: 0.5,
        fontSize: 24, bold: true, color: '059669', fontFace: 'Arial'
    });
    
    slide.addShape(pptx.ShapeType.line, { 
        x: 0.5, y: 0.9, w: '90%', h: 0, 
        line: { color: 'E2E8F0', width: 2 } 
    });

    // Info (Top row)
    slide.addText(`场景定位：${scene.location || '未知'}`, {
        x: 0.5, y: 1.1, w: 4, h: 0.4,
        fontSize: 12, color: '475569'
    });

    // Traits (Text block)
    slide.addText(scene.traits || '暂无描述', {
        x: 0.5, y: 1.6, w: 9, h: 1.0,
        fontSize: 11, color: '334155', valign: 'top', wrap: true
    });

    // Image (Main, Large)
    const validImages = scene.images.filter(img => img && img.length > 10);
    let mainImage = '';
    
    if (validImages.length > 0) {
        mainImage = await processImage(validImages[0]);
    }
    
    if (mainImage) {
        // Use the first image as the main one
        slide.addImage({
            data: mainImage,
            x: 0.5, y: 2.8, w: 9.0, h: 4.5,
            sizing: { type: 'contain', w: 9.0, h: 4.5 }
        });
    } else {
        slide.addText("（暂无生成图片）", {
           x: 0.5, y: 3.0, w: 9.0, h: 4.0,
           fontSize: 14, color: '94A3B8', align: 'center',
           shape: pptx.ShapeType.rect, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' }
        });
    }
}
