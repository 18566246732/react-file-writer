importScripts('./webm-writer2.js');

class DB {
    constructor(dbName, version) {
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

        this.mainRequest = indexedDB.open(this.dbName, this.version);

        
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
    addData(data, keyName) {
        const request = this.db.transaction([this.storeName], 'readwrite')
            .objectStore(this.storeName)
            .add({id: keyName, data});
        request.onsuccess = () => console.log('add data success');
        request.onerror = (e) => console.log('add data failed', e);
    }
    putData(data, keyName) {
        const request = this.db.transaction([this.storeName], 'readwrite')
            .objectStore(this.storeName)
            .put({id: keyName, data});
        request.onsuccess = () => console.log('put data success');
        request.onerror = (e) => console.log('put data failed', e);
    }
    async getData(keyName) {
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

const db = new DB('fileHandle', 1);


const addTimeStamp = (text) => {
    return '[' + new Date().toLocaleString() + '] ' + text;
}

const breakLine = (text) => {
    return text + '\n';
}

let videoWriter;
let frameReader;
let writableStream;
let textFileAccessHandle;
let encoder;


const globalParams = {
    directoryHandle: undefined,
    fileSizeQuota: undefined,
    filenamePrefix: undefined,
    filenameExtension: undefined,
    dbKeyForCurrentFileHandle: undefined,
    textFileHandle: undefined,
    createSyncAccessHandle: undefined,
    intervalHandle: undefined
}

const saveFile = async () => {
    await textFileAccessHandle.flush();
    await textFileAccessHandle.close();
    // await textFileAccessHandle.releaseLock();
}

const getFileHandle = async () => {
    const { filenamePrefix, filenameExtension } = globalParams;
    const fileFromDB = await db.getData(globalParams.dbKeyForCurrentFileHandle);
    const fileHandle = fileFromDB && fileFromDB.data;
    console.log(fileHandle, 'fileHandle');
    if (!fileHandle) {
        const date = new Date().toISOString().split('T')[0];
        const fileNameWithDate =  `${filenamePrefix}_${date}_${00}${filenameExtension}`;
        const _textFileHandle = await globalParams.directoryHandle.getFileHandle(fileNameWithDate, { create: true });
        db.putData(_textFileHandle, globalParams.dbKeyForCurrentFileHandle);
        return _textFileHandle;
    }

    try {
        const file = await fileHandle.getFile();
        console.log('get fileHandle from db', file);
    } catch (error) {
        console.log('getFile failed:', error);
        const date = new Date().toISOString().split('T')[0];
        const fileNameWithDate =  `${filenamePrefix}_${date}_${00}${filenameExtension}`;
        const _textFileHandle = await globalParams.directoryHandle.getFileHandle(fileNameWithDate, { create: true });
        db.putData(_textFileHandle, globalParams.dbKeyForCurrentFileHandle);
        return _textFileHandle;
    }


    return fileHandle;
}

async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    // The user didn't grant permission, so return false.
    return false;
  }


const createNewFileHandle = async () => {
    const { filenamePrefix, filenameExtension } = globalParams;
    try {
        const file = await globalParams.textFileHandle.getFile();
        chunkNum = (function getChunkNum() {
            const arr = file.name.split('_');
            const _lastChunkNum =  arr[arr.length - 1];
            const lastChunkNum = _lastChunkNum.split('.')[0];
            return Number(lastChunkNum) + 1;
        })();
    } catch (error) {
        console.log('getFile failed:', error);
    }

    const fileNameWithDate = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}_${chunkNum}${filenameExtension}`;
    const _textFileHandle = await globalParams.directoryHandle.getFileHandle(fileNameWithDate, { create: true });
    db.putData(_textFileHandle, globalParams.dbKeyForCurrentFileHandle);
    return _textFileHandle;
}

const getRelativePath = (entry) => {
    return entry.webkitRelativePath;
}

async function* getFilesRecursively (entry) {
    if (entry.kind === 'file') {
        const file = await entry.getFile();
    if (file !== null) {
        file.relativePath = getRelativePath(entry);
        yield file;
    }
    } else if (entry.kind === 'directory') {
        for await (const handle of entry.values()) {
            yield* getFilesRecursively(handle);
        }
    }
}

async function* getFilesHandleRecursively(entry) {
    if (entry.kind === 'file') {
        yield entry;
    } else if (entry.kind === 'directory') {
        for await (const handle of entry.values()) {
            yield* getFilesHandleRecursively(handle);
        }
    }
}

/* eslint-disable */
self.onmessage = async (e) => {
    switch (e.data?.cmd) {
        case 'startRecording':
            const fileHandle = e.data.fileHandle;
            const trackSettings = e.data.trackSettings;
            fileHandle.createWritable().then(_writable => {
                writableStream = _writable;
                videoWriter = new WebMWriter({
                    fileWriter: writableStream,
                    codec: 'VP9',
                    frameRate: 30,
                    width: trackSettings.width,
                    height: trackSettings.height
                });
            });
            frameReader = (function getFrameReader() {
                const frameReadable = e.data.frameReadable;
                return frameReadable.getReader()
            })();

            const videoEncoder = (function getVideoEncoder() {
                const init = {
                    output: (encodedChunk) => {
                        console.log('encodedChunk >>>', encodedChunk);
                        videoWriter?.addFrame(encodedChunk);
                    },
                    error: e => console.error('video encode error:', e)
                }
                const videoEncoder = new VideoEncoder(init);

                videoEncoder.configure({
                    codec: 'vp09.00.10.08',
                    framerate: 30,
                    bitrate: 15e5,
                    width: trackSettings.width,
                    height: trackSettings.height
                });
                return videoEncoder;
            })()
            frameReader.read().then(async function processFrame ({ done, value }) {
                if (done) {
                    await videoEncoder.flush();
                    videoEncoder.close();
                    return;
                }
                videoEncoder.encode(value);
                value.close();
                frameReader?.read().then(processFrame);
            });
            break;

        case 'startLogging':
            console.log('startLogging');
            const directoryHandle = globalParams.directoryHandle || await navigator.storage.getDirectory();

            console.log(directoryHandle, 'directoryHandle');
            const { filename, ext, quota } = e.data;
            globalParams.filenameExtension = ext;
            globalParams.filenamePrefix = filename;
            globalParams.directoryHandle = directoryHandle;
            globalParams.fileSizeQuota = quota;
            globalParams.dbKeyForCurrentFileHandle = `${filename}_currentFileHandle`;
            const textFileHandle = globalParams.textFileHandle || await getFileHandle();
            textFileAccessHandle = await textFileHandle.createSyncAccessHandle();
            encoder = new TextEncoder();
            self.postMessage({
                cmd: 'logWriter1Started'
            })
            globalParams.textFileHandle = textFileHandle;

        case 'logs':
            if (!textFileAccessHandle) {
                return;
            }
            const fileSize = await textFileAccessHandle.getSize();
            if (fileSize >= globalParams.fileSizeQuota) {
                await saveFile();
                const fileHandle = await createNewFileHandle();
                globalParams.textFileHandle = fileHandle;
                console.log(await fileHandle.getFile(), 'fileHandle');
                textFileAccessHandle = await fileHandle.createSyncAccessHandle();
                fileSize = 0;
            }
            const writeBuffer = encoder.encode(breakLine(addTimeStamp(e.data.text)));
            if (globalParams.createSyncAccessHandle) {
                const accessHandle = globalParams.createSyncAccessHandle;
                const fsize = await accessHandle.getSize();
                await accessHandle.write(writeBuffer, {at: fsize});
            }
            textFileAccessHandle.write(writeBuffer, {at: fileSize});
            break;
        case 'clearLog':
           {
                const directoryHandle = await navigator.storage.getDirectory();
                for await (const fileHandle of getFilesHandleRecursively(directoryHandle)) {
                    fileHandle.remove();
                }
                break;
           }

        case 'checkFiles':
            {
                const directoryHandle = await navigator.storage.getDirectory();
                for await (const fileHandle of getFilesRecursively(directoryHandle)) {
                    console.log(fileHandle);
                }
                break;
            }
            
        case 'saveLogging':
            self.postMessage({
                cmd: 'logWriterClosed'
            });
            await saveFile();
            const textFile = await globalParams.textFileHandle.getFile();
            console.log(textFile, textFile.size, 'textFile.size');
            break;

        case 'stopRecording':
            await frameReader?.cancel().catch(e => console.log(e, 'frame reader'));
            await videoWriter?.complete().then(res => console.log(res, 'res')).catch(e => console.log(e, 'complete error'));
            writableStream.close();
            break;

        case 'queryForFileNameUsingRange':
            const startDate = e.data.startDate;
            const endDate = e.data.endDate;
            const targetDirHandle = e.data.targetDirHandle;
            const rootDirHandle = await navigator.storage.getDirectory();
            for await (const fileHandle of getFilesHandleRecursively(rootDirHandle)) {
                const lastModified = (await fileHandle.getFile()).lastModified;
                if (lastModified > startDate && lastModified < endDate) {
                    if (globalParams.textFileHandle && await fileHandle.isSameEntry(globalParams.textFileHandle)) {
                        globalParams.textFileHandle = null;                        
                    }
                    await fileHandle.move(targetDirHandle);
                }
            }
            break;

        case 'writeRealTimeLog':
            {
                const directoryHandle = await navigator.storage.getDirectory();
                const tempLogFileHandle = await directoryHandle.getFileHandle('tempLog.txt', {create: true});
                
                const reader = new FileReader();
                const targetFileHandle = e.data.targetFileHandle;
                
                
                reader.onload = async (event) => {
                    await globalParams.createSyncAccessHandle.truncate(0);
                    const writable = (await targetFileHandle.createWritable({ keepExistingData: true }));
                    globalParams.writable = writable;
                    const targetLogFile = await targetFileHandle.getFile();
                    console.log(targetLogFile.size, 'targetLogFile.size');
                    writable.write({ type: "write", position: targetLogFile.size, data: event.target.result });
                    await writable.close();
                }

                const createSyncAccessHandle = await tempLogFileHandle.createSyncAccessHandle();

                globalParams.intervalHandle = setInterval(async () => {
                    const tempLogFile = await tempLogFileHandle.getFile();
                    reader.readAsArrayBuffer(tempLogFile);
                }, 1000);

                globalParams.createSyncAccessHandle = createSyncAccessHandle;
            }
            break;
        case 'stopRealTimeLog':
            clearInterval(globalParams.intervalHandle);

        default:
            break;
    }
}