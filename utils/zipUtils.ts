import JSZip from 'jszip';

export const downloadHistoryItem = async (
  name: string,
  infoContent: string,
  images: string[]
) => {
  const zip = new JSZip();
  const folderName = `${name}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
  const folder = zip.folder(folderName);

  if (!folder) return;

  // 1. Create Info Text File
  folder.file("角色设定.txt", infoContent);

  // 2. Add Images
  // Handle base64 images
  images.forEach((imgData, index) => {
    if (!imgData) return;
    
    // Remove data:image/png;base64, prefix
    const base64Data = imgData.split(',')[1];
    if (base64Data) {
        // Naming convention: view_1, view_2 (or standard names if we had them map, strictly simple here)
        const fileName = `视图_${index + 1}.png`;
        folder.file(fileName, base64Data, { base64: true });
    }
  });

  // 3. Generate Zip
  const content = await zip.generateAsync({ type: "blob" });
  
  // 4. Trigger Download
  const url = window.URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};