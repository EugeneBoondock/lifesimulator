import { Agent } from '../types';

const DB_NAME = 'aetheria_memory';
const DB_VERSION = 1;
const STORE_NAME = 'agents';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => { db = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  });
};

export const saveAllAgents = (agents: Agent[]): void => {
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const agent of agents) {
      store.put({
        id: agent.id,
        memories: (agent.memories || []).slice(-50),
        actionMemories: (agent.actionMemories || []).slice(-30),
        aiThoughts: (agent.aiThoughts || []).slice(-20),
        aiConversations: (agent.aiConversations || []).slice(-20),
        relationships: agent.relationships,
        knownTechnologies: agent.knownTechnologies,
      });
    }
  } catch (e) {
    console.warn('Failed to save agent memory:', e);
  }
};

export const loadAllAgents = (): Promise<Record<string, any>> => {
  return new Promise((resolve) => {
    if (!db) { resolve({}); return; }
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const result: Record<string, any> = {};
        for (const item of request.result) {
          result[item.id] = item;
        }
        resolve(result);
      };
      request.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
};
