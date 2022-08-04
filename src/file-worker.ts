import DBCreater from './db';

// trick typescript
const DB = DBCreater({});

type WebMWriterType = {
    addFrame(encodedChunk: EncodedVideoChunk | VideoFrame): void;
    complete(): Promise<void>;
}

export default () => {
    const db = new DB('fileHandle', 1);
    const addTimeStamp = (text: string) => {
        return '[' + new Date().toLocaleString() + '] ' + text;
    }
    const breakLine = (text: string) => {
        return text + '\n';
    }

    let videoWriter: WebMWriterType;
    let frameReader: ReadableStreamDefaultReader<VideoFrame>;
    let writableStream: FileSystemWritableFileStream;
    let textFileAccessHandle: FileSystemSyncAccessHandle;
    let encoder: TextEncoder;

    interface IGlobalParams {
        directoryHandle: FileSystemDirectoryHandle,
        fileSizeQuota: number,
        filenamePrefix: string,
        filenameExtension: string,
        dbKeyForCurrentFileHandle: string,
        textFileHandle: FileSystemFileHandle,
        syncAccessHandle: FileSystemSyncAccessHandle,
        mediaRecorder: MediaRecorder,
        mediaRecorderChunks: Array<Blob>,
        recoderFileHandle: FileSystemFileHandle,
        intervalHandle: number
    }

    type FEntry = FileSystemFileHandle | FileSystemDirectoryHandle;

    const globalParams: IGlobalParams = {
        directoryHandle: undefined,
        fileSizeQuota: undefined,
        filenamePrefix: undefined,
        filenameExtension: undefined,
        dbKeyForCurrentFileHandle: undefined,
        textFileHandle: undefined,
        syncAccessHandle: undefined,
        mediaRecorder: undefined,
        intervalHandle: undefined,
        recoderFileHandle: undefined,
        mediaRecorderChunks: []
    }

    const saveFile = async () => {
        await textFileAccessHandle.flush();
        await textFileAccessHandle.close();
    }

    const getFileHandle = async () => {
        const { filenamePrefix, filenameExtension } = globalParams;
        const fileFromDB = await db.getData(globalParams.dbKeyForCurrentFileHandle);
        const fileHandle: FileSystemFileHandle = fileFromDB && fileFromDB.data;
        if (!fileHandle) {
            const date = new Date().toISOString().split('T')[0];
            const fileNameWithDate = `${filenamePrefix}_${date}_00${filenameExtension}`;
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
            const fileNameWithDate = `${filenamePrefix}_${date}_00${filenameExtension}`;
            const _textFileHandle = await globalParams.directoryHandle.getFileHandle(fileNameWithDate, { create: true });
            db.putData(_textFileHandle, globalParams.dbKeyForCurrentFileHandle);
            return _textFileHandle;
        }


        return fileHandle;
    }

    async function verifyPermission(fileHandle: FileSystemFileHandle, readWrite?: boolean) {
        const options: {
            mode: FileSystemPermissionMode
        } = {
            mode: 'read'
        };
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
        let chunkNum = 0;
        try {
            const file = await globalParams.textFileHandle.getFile();
            chunkNum = (function getChunkNum() {
                const arr = file.name.split('_');
                const _lastChunkNum = arr[arr.length - 1];
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

    async function* getFilesRecursively(entry: FEntry): AsyncGenerator<File> {
        if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (file !== null) {
                yield file;
            }
        } else if (entry.kind === 'directory') {
            for await (const handle of entry.values()) {
                yield* getFilesRecursively(handle);
            }
        }
    }

    async function* getFilesHandleRecursively(entry: FEntry): AsyncGenerator<FileSystemFileHandle> {
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
                const fileHandle: FileSystemFileHandle = e.data.fileHandle;
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
                    const frameReadable: ReadableStream<VideoFrame> = e.data.frameReadable;
                    return frameReadable.getReader()
                })();

                const videoEncoder = (function getVideoEncoder() {
                    const init: VideoEncoderInit = {
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
                frameReader.read().then(async function processFrame({ done, value }) {
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
                const directoryHandle = globalParams.directoryHandle || await navigator.storage.getDirectory();
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
                    cmd: 'startWriting'
                })
                globalParams.textFileHandle = textFileHandle;
                break;

            case 'logs':
                if (!textFileAccessHandle) {
                    return;
                }
                let fileSize = await textFileAccessHandle.getSize();
                if (fileSize >= globalParams.fileSizeQuota) {
                    await saveFile();
                    const fileHandle = await createNewFileHandle();
                    globalParams.textFileHandle = fileHandle;
                    console.log(await fileHandle.getFile(), 'fileHandle');
                    textFileAccessHandle = await fileHandle.createSyncAccessHandle();
                    fileSize = 0;
                }
                const writeBuffer = encoder.encode(breakLine(addTimeStamp(e.data.text)));
                if (globalParams.syncAccessHandle) {
                    const accessHandle = globalParams.syncAccessHandle;
                    const fsize = await accessHandle.getSize();
                    await accessHandle.write(writeBuffer, { at: fsize });
                }
                textFileAccessHandle.write(writeBuffer, { at: fileSize });
                break;
            case 'clearLogFile':
                {
                    const directoryHandle = await navigator.storage.getDirectory();
                    for await (const fileHandle of getFilesHandleRecursively(directoryHandle)) {
                        const permission = await verifyPermission(fileHandle, true);

                        console.log(permission, 'permission', fileHandle);
                        

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
                    const tempLogFileHandle = await directoryHandle.getFileHandle('tempLog.txt', { create: true });

                    const reader = new FileReader();
                    const targetFileHandle = e.data.targetFileHandle;


                    reader.onload = async (event) => {
                        await globalParams.syncAccessHandle.truncate(0);
                        const writable = (await targetFileHandle.createWritable({ keepExistingData: true }));
                        const targetLogFile = await targetFileHandle.getFile();
                        console.log(targetLogFile.size, 'targetLogFile.size');
                        writable.write({ type: "write", position: targetLogFile.size, data: event.target.result });
                        await writable.close();
                    }

                    const syncAccessHandle = await tempLogFileHandle.createSyncAccessHandle();

                    globalParams.intervalHandle = setInterval(async () => {
                        const tempLogFile = await tempLogFileHandle.getFile();
                        reader.readAsArrayBuffer(tempLogFile);
                        reader.abort();
                    }, 1000);

                    globalParams.syncAccessHandle = syncAccessHandle;
                }
                break;
            case 'stopRealTimeLog':
                clearInterval(globalParams.intervalHandle);
                globalParams.syncAccessHandle.flush();
                globalParams.syncAccessHandle.close();
                globalParams.syncAccessHandle = null;
                break;

            case 'startRecorder':

                // const mediaRecorder = new MediaRecorder(e.data.stream, { mimeType: 'video/webm; codecs=vp9' });
                // const mediaRecorder: MediaRecorder = e.data.mediaRecorder;
                // mediaRecorder.ondataavailable = e => {
                //     globalParams.mediaRecorderChunks.push(e.data);
                // }
                // mediaRecorder.start();
                // globalParams.mediaRecorder = mediaRecorder;

                globalParams.recoderFileHandle = e.data.recoderFileHandle;
                break;

            case 'onRecorderData':
                const data = e.data;
                console.log(data, 'data');
                
                globalParams.mediaRecorderChunks.push(data);
                break;
                // globalParams.recoderFileHandle.createWritable

            case 'stopRecorder':
                // globalParams.mediaRecorder.stop();
                // const recoderFileWritable = await globalParams.recoderFileHandle.createWritable();
                // const blob = new Blob(globalParams.mediaRecorderChunks, { type: 'video/webm; codecs=vp9' });
                // console.log(blob, 'blob');
                
                // await recoderFileWritable.write(blob);

                // console.log(await globalParams.recoderFileHandle.getFile(), 'file');
                
                // recoderFileWritable.close();
                
                break;
            default:
                break;
        }
    }
}