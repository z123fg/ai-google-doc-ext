// src/db.js
const DB_NAME = "AI_Search_DB";
const DB_VERSION = 3;
const DOCUMENT_STORE_NAME = "documents";
const CHUNK_STORE_NAME = "document_chunks";
const LEGACY_CHUNK_STORE_NAME = "document_vectors";
const LEGACY_META_STORE_NAME = "index_meta";

function deleteChunksByDocument(store, documentId) {
    return new Promise((resolve, reject) => {
        const request = store
            .index("documentId")
            .openCursor(IDBKeyRange.only(documentId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve();
                return;
            }
            cursor.delete();
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}

export const db = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (database.objectStoreNames.contains(LEGACY_CHUNK_STORE_NAME)) {
                    database.deleteObjectStore(LEGACY_CHUNK_STORE_NAME);
                }
                if (database.objectStoreNames.contains(LEGACY_META_STORE_NAME)) {
                    database.deleteObjectStore(LEGACY_META_STORE_NAME);
                }
                if (database.objectStoreNames.contains(CHUNK_STORE_NAME)) {
                    database.deleteObjectStore(CHUNK_STORE_NAME);
                }
                if (database.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
                    database.deleteObjectStore(DOCUMENT_STORE_NAME);
                }

                const documentStore = database.createObjectStore(
                    DOCUMENT_STORE_NAME,
                    {
                        keyPath: "id",
                    },
                );
                documentStore.createIndex("name", "name", { unique: false });

                const chunkStore = database.createObjectStore(CHUNK_STORE_NAME, {
                    keyPath: "id",
                });
                chunkStore.createIndex("documentId", "documentId", {
                    unique: false,
                });
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getDocuments() {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const request = database
                .transaction(DOCUMENT_STORE_NAME)
                .objectStore(DOCUMENT_STORE_NAME)
                .getAll();

            request.onsuccess = () => {
                resolve(
                    (request.result || []).sort(
                        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
                    ),
                );
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getDocumentByName(name) {
        const documents = await this.getDocuments();
        return documents.find((document) => document.name === name) ?? null;
    },

    async replaceDocument(documentRecord, chunks) {
        await this.removeDocument(documentRecord.id);

        const database = await this.init();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(
                [DOCUMENT_STORE_NAME, CHUNK_STORE_NAME],
                "readwrite",
            );
            const documentStore = tx.objectStore(DOCUMENT_STORE_NAME);
            const chunkStore = tx.objectStore(CHUNK_STORE_NAME);

            documentStore.put(documentRecord);
            chunks.forEach((chunk) => chunkStore.put(chunk));

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    async setDocumentEnabled(documentId, enabled) {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(DOCUMENT_STORE_NAME, "readwrite");
            const store = tx.objectStore(DOCUMENT_STORE_NAME);
            const request = store.get(documentId);

            request.onsuccess = () => {
                const existing = request.result;
                if (!existing) return;

                store.put({
                    ...existing,
                    enabled,
                    updatedAt: Date.now(),
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    async removeDocument(documentId) {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(
                [DOCUMENT_STORE_NAME, CHUNK_STORE_NAME],
                "readwrite",
            );
            const documentStore = tx.objectStore(DOCUMENT_STORE_NAME);
            const chunkStore = tx.objectStore(CHUNK_STORE_NAME);

            deleteChunksByDocument(chunkStore, documentId)
                .then(() => {
                    documentStore.delete(documentId);
                })
                .catch(reject);

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    async getAllChunks() {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const request = database
                .transaction(CHUNK_STORE_NAME)
                .objectStore(CHUNK_STORE_NAME)
                .getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async getEnabledChunks() {
        const [documents, chunks] = await Promise.all([
            this.getDocuments(),
            this.getAllChunks(),
        ]);
        const enabledDocumentIds = new Set(
            documents
                .filter((document) => document.enabled)
                .map((document) => document.id),
        );

        return chunks.filter((chunk) => enabledDocumentIds.has(chunk.documentId));
    },
};
