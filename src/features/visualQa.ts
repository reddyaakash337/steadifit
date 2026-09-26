export const isVisualQaEnabled =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_VISUAL_QA === 'true';
