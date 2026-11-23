const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
let database;
async function open() {
  if (!database) database = new Promise((resolve, reject) => {
    const r = indexedDB.open('threadkeep', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('library');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Close other Threadkeep tabs and try again.'));
  });
  return database;
}
export async function readLibrary() {
  const db = await open();
  return await request(db.transaction('library').objectStore('library').get('state')) || {chats: [], projects: []};
}
export async function saveLibrary(state) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readwrite');
    tx.objectStore('library').put(state, 'state');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
  });
}
