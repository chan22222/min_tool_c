// IndexedDB 기반 대용량 캐시 매니저
class IndexedDBCache {
    constructor() {
        this.dbName = 'NaverSearchCache';
        this.storeName = 'keywords';
        this.db = null;
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'keyword' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async get(keyword) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(keyword);
            
            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    const now = Date.now();
                    const DAY = 24 * 60 * 60 * 1000;
                    if (now - data.timestamp < DAY) {
                        resolve(data.result);
                        return;
                    }
                    // 만료된 데이터 삭제
                    this.delete(keyword);
                }
                resolve(null);
            };
            
            request.onerror = () => resolve(null);
        });
    }

    async set(keyword, result) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.put({
                keyword: keyword,
                result: result,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async delete(keyword) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(keyword);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCount() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
        });
    }

    async cleanup() {
        // 만료된 데이터 정리
        if (!this.db) await this.initDB();
        
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('timestamp');
        
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;
        const cutoff = now - DAY;
        
        const range = IDBKeyRange.upperBound(cutoff);
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
    }
}

// 100만개도 처리 가능! (실제로는 디스크 공간만큼)
// IndexedDB는 보통 디스크 공간의 50%까지 사용 가능