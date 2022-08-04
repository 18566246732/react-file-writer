export default (global: any) => {
    class DB {
        dbName: string;
        version: number;
        mainRequest: IDBOpenDBRequest;
        keyPath: string;
        storeName: string;
        db: IDBDatabase;
    
        constructor(dbName: string, version: number) {
            this.db = null;
            this.storeName = 'fileHandle';
            this.mainRequest = null;
            this.dbName = dbName;
            this.version = version || 0;
            this.keyPath = 'id';
            this.init();
        }
        init() {
            if (!this.dbName) {
                throw new Error('db name not provided')
            }
            this.mainRequest = global.indexedDB.open(this.dbName, this.version);

            this.mainRequest.onsuccess = (e) => {
                // @ts-ignore
                this.db = e.target.result;
                console.log('db open success');
                this.onOpenSuccessCallback();
            }
            this.mainRequest.onerror = () => {
                console.log('db open failed');
            } 
            this.mainRequest.onupgradeneeded = e => {
                console.log("onupgradeneeded");
                // @ts-ignore
                this.db = e.target.result;
                if (!this.db.objectStoreNames.contains(this.storeName)) {
                    this.db.createObjectStore(this.storeName, {
                        keyPath: this.keyPath
                    });
                }
            }
        }
        addData(data: any, keyName: string) {
            const request = this.db.transaction([this.storeName], 'readwrite')
                .objectStore(this.storeName)
                .add({id: keyName, data});
            request.onsuccess = () => console.log('add data success');
            request.onerror = (e) => console.log('add data failed', e);
        }
        putData(data: any, keyName: string) {
            const request = this.db.transaction([this.storeName], 'readwrite')
                .objectStore(this.storeName)
                .put({id: keyName, data});
            request.onsuccess = () => console.log('put data success');
            request.onerror = (e) => console.log('put data failed', e);
        }
        async getData(keyName: string): Promise<{ data: any }> {
            return new Promise((res, rej) => {
                const request = this.db.transaction([this.storeName], 'readwrite')
                .objectStore(this.storeName)
                .get(keyName);
                request.onsuccess = (e) => {
                    console.log('getData ' + keyName + ' success');
                    // @ts-ignore
                    return res(e.target.result)
                }
                request.onerror = (e) => {
                    console.log('getData ' + keyName + ' failed');
                    return rej(e)
                }
            })
        }
        close() {
            this.db.close();
            console.log('database closed');
        }
    
        onOpenSuccessCallback() {
            console.log('the open success callback has not be implemented')
        }
    }

    return global.DB = DB;
}

