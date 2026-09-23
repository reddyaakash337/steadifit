import * as Crypto from 'expo-crypto';

export const createId = (): string => Crypto.randomUUID();
