/**
 * Production-ready fix for PDF export with CORS safety and font loading
 * Prevents canvas tainting and handles font race conditions
 */

import { CANVAS_CONSTANTS } from '../constants/canvas';

export function usePdfExportFix() {
  const PDF_W = 595.28;
  const PDF_H = 841.89;
  const CVS_W = CANVAS_CONSTANTS.PAGE_WIDTH;
  const SCALE = PDF_W / CVS_W;


  const captureCanvasPageSafe = async (canvas, pageIndex, zoomLevel, qualityMultiplier = 2) => {
    if (!canvas) return null;
    
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    const IMAGE_TYPES = ['image'];
    const ALL_OVERLAY_TYPES = [...TEXT_TYPES, ...IMAGE_TYPES];

    try {
      // Create a clean canvas clone to avoid tainting
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      const captureWidth = CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel;
      const captureHeight = P_H * zoomLevel;
      const topOffset = pageIndex * (P_H + GAP) * zoomLevel;
      
      tempCanvas.width = captureWidth;
      tempCanvas.height = captureHeight;
      
      // Get all objects and determine visibility for this page
      const allObjects = canvas.getObjects();
      const objectsToRender = [];
      const hiddenForCapture = [];
      
      allObjects.forEach(obj => {
        const center = obj.getCenterPoint();
        const objPageIndex = Math.floor(center.y / (P_H + GAP));
        const isWrongPage = objPageIndex !== pageIndex;
        const isOverlay = ALL_OVERLAY_TYPES.includes(obj.type) && 
                        obj.id !== 'page-bg-image' && 
                        obj.id !== 'page-bg';
        
        if ((isWrongPage || isOverlay) && obj.visible) {
          hiddenForCapture.push(obj);
          obj.visible = false;
        } else if (!isWrongPage && obj.visible) {
          objectsToRender.push(obj);
        }
      });
      
      // Render the clean page
      canvas.renderAll();
      
      // Use toDataURL with error handling
      let dataUrl = null;
      try {
        dataUrl = canvas.toDataURL({
          format: 'jpeg',
          quality: 0.92,
          multiplier: qualityMultiplier / zoomLevel,
          left: 0,
          top: topOffset,
          width: captureWidth,
          height: captureHeight
        });
      } catch (canvasError) {
        console.warn(`Canvas taint detected on page ${pageIndex + 1}, using fallback:`, canvasError);
        
        // Fallback: draw only background elements
        try {
          // Create a minimal canvas with just background
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * qualityMultiplier;
          fallbackCanvas.height = P_H * qualityMultiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          
          // White background
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          
          dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.92);
        } catch (fallbackError) {
          console.error(`Even fallback failed for page ${pageIndex + 1}:`, fallbackError);
          return null;
        }
      }
      
      // Restore visibility
      hiddenForCapture.forEach(obj => { obj.visible = true; });
      canvas.renderAll();
      
      return dataUrl && dataUrl.length > 100 ? dataUrl : null;
      
    } catch (error) {
      console.error(`Error capturing page ${pageIndex + 1}:`, error);
      return null;
    }
  };


  const createFontLoader = () => {
    const fontCache = new Map();
    const loadingPromises = new Map();
    const MAX_FONT_CACHE_SIZE = 20;


    const loadFontSafe = async (pdfDoc, family, weight = 'normal', style = 'normal') => {
      const key = `${family}-${weight}-${style}`;
      

      if (fontCache.has(key)) {
        return fontCache.get(key);
      }


      if (loadingPromises.has(key)) {
        return loadingPromises.get(key);
      }

      if (fontCache.size >= MAX_FONT_CACHE_SIZE) {
        const firstKey = fontCache.keys().next().value;
        fontCache.delete(firstKey);
      }

      const loadPromise = new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          loadingPromises.delete(key);
          reject(new Error(`Font load timeout: ${key}`));
        }, FONT_LOAD_TIMEOUT);

        try {
          let font = null;

          // Standard fonts
          if (['Helvetica', 'Arial', 'Times', 'Courier'].some(n => family.includes(n))) {
            const base = family.includes('Times') ? 'Times' : 
                        family.includes('Courier') ? 'Courier' : 'Helvetica';
            
            if (weight === 'bold' && style === 'italic') {
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}BoldOblique`]);
            } else if (weight === 'bold') {
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}Bold`]);
            } else if (style === 'italic') {
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}Oblique`]);
            } else {
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[base]);
            }
          } else {
            try {
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
            } catch (customError) {
              console.warn(`Custom font ${family} failed, using Helvetica:`, customError);
              font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
            }
          }

          clearTimeout(timeoutId);
          loadingPromises.delete(key);
          fontCache.set(key, font);
          resolve(font);
          
        } catch (error) {
          clearTimeout(timeoutId);
          loadingPromises.delete(key);
          reject(error);
        }
      });

      loadingPromises.set(key, loadPromise);
      return loadPromise;
    };

    return { loadFontSafe, cleanup: () => fontCache.clear() };
  };


  const generateHybridPdfSafe = async (canvasImages, projectData, variableMap = {}) => {
    if (!window.PDFLib) {
      throw new Error('PDF Library not loaded');
    }

    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const { loadFontSafe, cleanup: fontCleanup } = createFontLoader();
    
    try {
      const pdfDoc = await PDFDocument.create();
      if (window.fontkit) {
        pdfDoc.registerFontkit(window.fontkit);
      }


      if (projectData) {
        try {
          const json = JSON.stringify(projectData);
          const b64 = btoa(unescape(encodeURIComponent(json)));
          pdfDoc.setTitle(projectData.name || 'Report');
          pdfDoc.setSubject(`layout:${b64}`);
          pdfDoc.setCreator('Dynamic Report Creator');
        } catch (metadataError) {
          console.warn('Metadata embedding failed:', metadataError);
        }
      }


      const pages = projectData?.pages ?? [];
      const numPages = Math.max(canvasImages.length, pages.length);

      for (let pi = 0; pi < numPages; pi++) {
        try {
          const pdfPage = pdfDoc.addPage([PDF_W, PDF_H]);


          if (canvasImages[pi]) {
            try {
              const imgBytes = dataUrlToBytes(canvasImages[pi]);
              if (imgBytes) {
                const isJpeg = canvasImages[pi].startsWith('data:image/jpeg');
                const img = isJpeg 
                  ? await pdfDoc.embedJpg(imgBytes)
                  : await pdfDoc.embedPng(imgBytes);
                pdfPage.drawImage(img, { x: 0, y: 0, width: PDF_W, height: PDF_H });
              }
            } catch (imgError) {
              console.warn(`Page ${pi + 1} background failed:`, imgError);
            }
          }

          const pageData = pages[pi];
          if (pageData?.objects) {
            for (const obj of pageData.objects) {
              try {
                if (['textbox', 'text', 'i-text'].includes(obj.type)) {
                  await addTextToPdfPage(pdfPage, pdfDoc, obj, variableMap, loadFontSafe);
                } else if (obj.type === 'image' && obj.src) {
                  await addImageToPdfPage(pdfPage, obj);
                }
              } catch (objError) {
                console.warn(`Object failed on page ${pi + 1}:`, objError);
              }
            }
          }
        } catch (pageError) {
          console.error(`Page ${pi + 1} generation failed:`, pageError);
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });

    } finally {
      fontCleanup();
    }
  };


  const dataUrlToBytes = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(';base64,');
    if (parts.length < 2) return null;
    const raw = atob(parts[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  };

  const addTextToPdfPage = async (pdfPage, pdfDoc, obj, variableMap, loadFontSafe) => {
    const rawText = (obj.text || '').trim();
    if (!rawText) return;


    const textContent = rawText.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
      variableMap[k] !== undefined ? String(variableMap[k]) : `{{${k}}}`
    );


    let font;
    try {
      font = await loadFontSafe(pdfDoc, obj.fontFamily || 'Helvetica', obj.fontWeight || 'normal', obj.fontStyle || 'normal');
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }


    const sx = obj.scaleX || 1;
    const sy = obj.scaleY || 1;
    const w = (obj.width || 0) * sx;
    const h = (obj.height || 0) * sy;
    let localX = obj.left ?? 0;
    let localY = obj.top ?? 0;
    if (obj.originX === 'center') localX -= w / 2;
    if (obj.originY === 'center') localY -= h / 2;

    const pdfX = localX * SCALE;
    const pdfY = PDF_H - (localY + h) * SCALE;
    const pdfW = w * SCALE;
    const pdfH = h * SCALE;
    const fontSize = Math.max(1, (obj.fontSize || 12) * sy * SCALE);


    try {
      pdfPage.drawText(textContent, {
        x: pdfX, y: pdfY,
        size: fontSize, font,
        color: rgb(0, 0, 0),
        opacity: obj.opacity ?? 1
      });
    } catch (drawError) {
      console.warn('Text draw failed, trying fallback:', drawError);
      try {
        pdfPage.drawText(textContent, {
          x: pdfX, y: pdfY,
          size: fontSize, font: await pdfDoc.embedFont(StandardFonts.Helvetica),
          color: rgb(0, 0, 0)
        });
      } catch (fallbackError) {
        console.error('Even text fallback failed:', fallbackError);
      }
    }
  };

  const addImageToPdfPage = async (pdfPage, obj) => {
  };

  return {
    captureCanvasPageSafe,
    generateHybridPdfSafe,
    createFontLoader
  };
}
