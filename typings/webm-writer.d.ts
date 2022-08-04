interface IWebMWriter {
    fileWriter: FileSystemWritableFileStream,
    codec: string;
    width: number;
    frameRate: number;
    height: number;
}

declare class WebMWriter {
    constructor(parameters: IWebMWriter) {}
    addFrame(encodedChunk: EncodedVideoChunk | VideoFrame): void;
    complete(): Promise<void>;
}

declare module 'webm-writer' {
    export = WebMWriter
}