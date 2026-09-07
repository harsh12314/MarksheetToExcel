/**
 * Client-Side Local Storage for Marksheet Photos & PDFs using browser IndexedDB.
 * 
 * Why IndexedDB?
 * - Standard localStorage has a tiny 5MB limit that crashes on 1-2 photos.
 * - IndexedDB allows storing hundreds of MBs/GBs of Blobs, Photos, and PDFs
 *   directly on each user's device/browser hard drive.
 * - 100% private: each user's photos stay strictly on their own machine.
 * - Works anywhere (Vercel, Render, local network, etc.) without needing cloud storage.
 */

const DB_NAME = 'MarksheetLocalDocStore';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

interface StoredDoc {
  id: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result as IDBDatabase);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open local document store'));
    };
  });
}

/**
 * Save a marksheet photo or PDF file into the user's browser local IndexedDB.
 */
export async function saveDocumentLocally(
  id: string,
  fileOrBlob: File | Blob,
  fileName = 'marksheet'
): Promise<void> {
  try {
    const db = await openDB();
    const mimeType = fileOrBlob.type || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const entry: StoredDoc = {
      id,
      blob: fileOrBlob,
      mimeType,
      fileName,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`[LocalStore] Could not save document ${id} locally:`, e);
  }
}

/**
 * Retrieve a marksheet photo or PDF from local IndexedDB and return an Object URL.
 */
export async function getDocumentUrl(id: string): Promise<string | null> {
  try {
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as StoredDoc | undefined;
        if (!result || !result.blob) {
          resolve(null);
          return;
        }

        const url = URL.createObjectURL(result.blob);
        resolve(url);
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (e) {
    console.warn(`[LocalStore] Could not load document ${id}:`, e);
    return null;
  }
}

/**
 * Check if a document is saved locally.
 */
export async function hasDocument(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(id);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Delete a document from local storage.
 */
export async function deleteDocumentLocally(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn(`[LocalStore] Could not delete document ${id}:`, e);
  }
}

/**
 * Delete multiple documents from local storage.
 */
export async function deleteDocumentsLocally(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('[LocalStore] Could not delete batch documents:', e);
  }
}

/**
 * Clear all locally stored marksheet documents.
 */
export async function clearAllLocalDocuments(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('[LocalStore] Could not clear all documents:', e);
  }
}
