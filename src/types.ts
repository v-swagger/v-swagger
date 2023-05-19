export type FileNameHash = string;

export interface IPreviewer {
    preview(): Promise<void>;
}

export type RewriteConfig = Record<string, string>;

export type $RefSchema = { $ref?: string };

export type Normalized$Ref = { absolutePath: string; hashPath: string };

export type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

export enum WebSocketEvents {
    Connection = 'connection',
    Load = 'load',
    Push = 'push',
}
