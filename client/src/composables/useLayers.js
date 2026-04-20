import { ref } from 'vue';

export const useLayers = () => {
  const layers = ref([]);

  const updateLayers = (canvas) => {
    if (!canvas) {
      layers.value = [];
      return;
    }

    const objects = canvas.getObjects();
    const activeObject = canvas.getActiveObject();

    const userObjects = objects.filter((obj) => obj.id !== 'page-bg' && obj.id !== 'page-bg-image');

    const mappedLayers = userObjects.map((obj, index) => {
      let label = 'Object';
      if (obj.type === 'image') label = 'Image';
      else if (['textbox', 'text', 'i-text'].includes(obj.type)) label = 'Text';
      else if (['rect', 'circle', 'polygon', 'path', 'line'].includes(obj.type)) label = 'Shape';
      else if (obj.type === 'group') label = 'Group';

      return {
        id: obj.id || `layer-${index}`,
        label,
        index: index + 1,
        isActive: activeObject === obj,
        rawObject: obj
      };
    });

    layers.value = mappedLayers.reverse();
  };

  return {
    layers,
    updateLayers
  };
};
