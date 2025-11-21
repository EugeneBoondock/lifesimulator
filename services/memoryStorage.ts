import { Agent } from '../types';

const DB_NAME = 'lifesimulator';
const DB_VERSION = 1;
const STORE_NAME = 'agents';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveAgent = async (agent: Agent): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Save only memory-related data
    const memoryData = {
      id: agent.id,
      name: agent.name,
      memories: agent.memories,
      actionMemories: agent.actionMemories,
      aiThoughts: agent.aiThoughts,
      aiConversations: agent.aiConversations,
      relationships: agent.relationships,
      personality: agent.personality,
      lastSaved: Date.now()
    };
    store.put(memoryData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadAgent = async (id: string): Promise<Partial<Agent> | null> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const loadAllAgents = async (): Promise<Record<string, Partial<Agent>>> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result: Record<string, Partial<Agent>> = {};
      for (const agent of request.result) {
        result[agent.id] = agent;
      }
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveAllAgents = async (agents: Agent[]): Promise<void> => {
  for (const agent of agents) {
    await saveAgent(agent);
  }
};

export const clearAllMemories = async (): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
