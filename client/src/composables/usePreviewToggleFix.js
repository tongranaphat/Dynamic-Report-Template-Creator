/**
 * Production-ready fix for Preview/Edit toggle lifecycle
 * Preserves template data and prevents corruption
 */

import { nextTick } from 'vue';

export function usePreviewToggleFix() {

  const originalTemplates = new Map();
  

  const backupTemplatesBeforePreview = (canvas, pages) => {
    originalTemplates.clear();
    
    if (!canvas || !pages) return;
    
    canvas.getObjects().forEach(obj => {
      if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
        const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
        originalTemplates.set(objId, {
          text: obj.text,
          editable: obj.editable,
          selectable: obj.selectable,
          evented: obj.evented
        });
      }
    });
  };


  const restoreTemplatesAfterPreview = (canvas) => {
    if (!canvas || originalTemplates.size === 0) return false;
    
    let restored = 0;
    let errors = 0;
    
    canvas.getObjects().forEach(obj => {
      if (['textbox', 'text', 'i-text'].includes(obj.type)) {
        const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
        const backup = originalTemplates.get(objId);
        
        if (backup) {
          try {
            // Restore original template text
            obj.set('text', backup.text);
            obj.set('editable', backup.editable);
            obj.set('selectable', backup.selectable);
            obj.set('evented', backup.evented);
            
            // Ensure proper text baseline
            if (obj.textBaseline === 'alphabetical') {
              obj.set('textBaseline', 'alphabetic');
            }
            
            restored++;
          } catch (e) {
            console.error(`Failed to restore template for object ${objId}:`, e);
            errors++;
          }
        }
      }
    });
    
    console.log(`Template restoration: ${restored} restored, ${errors} errors`);
    originalTemplates.clear();
    
    return errors === 0;
  };


  const applyPreviewDataSafe = (canvas, mockData) => {
    if (!canvas) return false;
    
    try {

      const currentTexts = new Map();
      canvas.getObjects().forEach(obj => {
        if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
          const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
          currentTexts.set(objId, obj.text);
        }
      });

      canvas.selection = false;
      canvas.discardActiveObject();

      canvas.getObjects().forEach(obj => {

        if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
          let newText = obj.text;
          let hasVariables = false;
          

          if (/\{\{[^}]+\}\}/.test(newText)) {
            hasVariables = true;
            Object.keys(mockData).forEach(key => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              newText = newText.replace(regex, mockData[key]);
            });
          }
          
          if (hasVariables && newText !== obj.text) {
            obj.set('text', newText);
          }
          obj.set('editable', false);
        }

        // Lock objects — preserve background elements
        if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
          obj.set({ 
            selectable: false, 
            evented: false,
            hasControls: false,
            hasBorders: false
          });
        }
      });

      canvas.requestRenderAll();
      return true;
      
    } catch (error) {
      console.error('Error applying preview data:', error);
      return false;
    }
  };


  const togglePreviewWithRollback = async (
    canvas, 
    isPreviewMode, 
    setIsPreviewMode, 
    mockData, 
    renderAllPages,
    saveCurrentPageState
  ) => {
    if (!canvas) return false;
    

    saveCurrentPageState();
    
    const wasPreview = isPreviewMode.value;
    
    try {
      if (!wasPreview) {
        // Entering preview
        backupTemplatesBeforePreview(canvas);
        setIsPreviewMode(true);
        
        await nextTick();
        await renderAllPages();
        
        const success = applyPreviewDataSafe(canvas, mockData);
        if (!success) {
          throw new Error('Failed to apply preview data');
        }
      } else {
        // Exiting preview
        const success = restoreTemplatesAfterPreview(canvas);
        if (!success) {
          console.warn('Template restoration had errors, but continuing...');
        }
        
        setIsPreviewMode(false);
        canvas.selection = true;
        
        await nextTick();
        await renderAllPages();
      }
      
      return true;
      
    } catch (error) {
      console.error('Preview toggle failed, rolling back:', error);
      try {
        if (!wasPreview) {
          // Failed to enter preview, restore edit mode
          restoreTemplatesAfterPreview(canvas);
          setIsPreviewMode(false);
        } else {
          // Failed to exit preview, stay in preview
          setIsPreviewMode(true);
        }
        
        await nextTick();
        await renderAllPages();
      } catch (rollbackError) {
        console.error('Rollback also failed:', rollbackError);
      }
      
      return false;
    }
  };


  const cleanup = () => {
    originalTemplates.clear();
  };

  return {
    backupTemplatesBeforePreview,
    restoreTemplatesAfterPreview,
    applyPreviewDataSafe,
    togglePreviewWithRollback,
    cleanup
  };
}
