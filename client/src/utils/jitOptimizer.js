export const stripCanvasDefaults = (canvasJson) => {
  if (!canvasJson || !canvasJson.objects) return canvasJson;

  const defaultProps = {
    stroke: null,
    strokeWidth: 1,
    fillRule: 'nonzero',
    paintFirst: 'fill',
    globalCompositeOperation: 'source-over',
    skewX: 0,
    skewY: 0,
    angle: 0,
    flipX: false,
    flipY: false,
    shadow: null,
    visible: true,
    backgroundColor: ''
  };

  const optimizedObjects = canvasJson.objects.map((obj) => {
    const cleanObj = { ...obj };
    Object.keys(defaultProps).forEach((key) => {
      if (cleanObj[key] === defaultProps[key]) {
        delete cleanObj[key]; // Delete if it's just the default
      }
    });
    return cleanObj;
  });

  return { ...canvasJson, objects: optimizedObjects };
};

export const optimizeImagesInPayload = async (canvasJson) => {
  if (!canvasJson || !canvasJson.objects) return canvasJson;

  const optimizedObjects = await Promise.all(
    canvasJson.objects.map(async (obj) => {
      if (obj.type === 'image' && obj.src && obj.src.startsWith('data:image')) {
        // Check if it's significantly scaled down
        if (obj.scaleX < 0.8 || obj.scaleY < 0.8) {
          const finalWidth = Math.round(obj.width * obj.scaleX);
          const finalHeight = Math.round(obj.height * obj.scaleY);

          const resampledSrc = await resampleImageBase64(obj.src, finalWidth, finalHeight);

          return {
            ...obj,
            src: resampledSrc,
            scaleX: 1,
            scaleY: 1,
            width: finalWidth,
            height: finalHeight
          };
        }
      }
      return obj;
    })
  );

  return { ...canvasJson, objects: optimizedObjects };
};

const resampleImageBase64 = (base64Str, targetWidth, targetHeight) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(tempCanvas.toDataURL('image/jpeg', 0.85)); // 0.85 Quality compression
    };
    img.src = base64Str;
  });
};

export const pruneDatasetForCanvas = (canvasJson, massiveDatasetArray) => {
  const requiredKeys = new Set();
  const regex = /{{\s*([^}]+)\s*}}/g;

  if (canvasJson && canvasJson.objects) {
    canvasJson.objects.forEach((obj) => {
      if (obj.type === 'i-text' || obj.type === 'text') {
        let match;
        while ((match = regex.exec(obj.text)) !== null) {
          requiredKeys.add(match[1].trim());
        }
      }
    });
  }

  return massiveDatasetArray.map((record) => {
    const prunedRecord = {};
    requiredKeys.forEach((key) => {
      if (record[key] !== undefined) {
        prunedRecord[key] = record[key];
      }
    });
    return prunedRecord;
  });
};
