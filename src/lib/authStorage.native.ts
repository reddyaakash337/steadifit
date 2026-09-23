import 'expo-sqlite/localStorage/install';

export const authStorage = {
  getItem: async (key: string) => globalThis.localStorage.getItem(key),
  setItem: async (key: string, value: string) => globalThis.localStorage.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage.removeItem(key),
};
