const DB_NAME = 'namemc-local-skin-library';
const DB_VERSION = 1;
const STORE_NAME = 'skins';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地皮肤库'));
  });
}

async function runTransaction(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地皮肤库操作失败'));
    transaction.oncomplete = () => database.close();
  });
}

export function listSkins() {
  return runTransaction('readonly', store => store.getAll());
}

export function saveSkin(skin) {
  return runTransaction('readwrite', store => store.put(skin));
}

export function removeSkin(id) {
  return runTransaction('readwrite', store => store.delete(id));
}

export function createSkinRecord(file) {
  return {
    id: `local-${crypto.randomUUID()}`,
    name: file.name,
    blob: file,
    createdAt: Date.now()
  };
}
