export type FileNameHash = string;

export interface Previewer {
    preview(): Promise<void>;
}
