
declare interface FileSystemFileHandle {
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
    remove(): void;
    move(targetDirHandle: FileSystemDirectoryHandle): void;
}

declare interface FileSystemSyncAccessHandle {
    write(buffer: BufferSource, options: any): void;
    getSize(): Promise<number>;
    flush(): Promise<void>;
    close(): Promise<void>;
    truncate(size: number): Promise<void>
};




// export interface FileSystemFileHandle extends FileSystemHandle {
//     createSyncAccessHandle: () => Promise<FileSystemSyncAccessHandle>;
// };