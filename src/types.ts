export type FileNameHash = string;

export interface Previewer {
    preview(): Promise<void>;
}

export type RewriteConfig = Record<string, string>;

export type $RefSchema = { $ref?: string };
