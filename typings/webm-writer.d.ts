interface IWebMWriter {
    fileWriter: FileSystemWritableFileStream,
    codec: string;
    width: number;
    height: number;
}

declare class WebMWriter {
    constructor(parameters: IWebMWriter) {}
    addFrame(encodedChunk: EncodedVideoChunk | VideoFrame): void;
    complete(): void;
}

declare module 'webm-writer' {
    export = WebMWriter
}