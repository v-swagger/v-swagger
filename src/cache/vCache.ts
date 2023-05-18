import { OpenAPI } from 'openapi-types';
import { FileNameHash } from '../types';

export type CacheEntry = {
    fileName: string;
    // indicate whether cache is fresh. If must revalidate is set to true. Need to re-parse the schema
    mustRevalidate: boolean;
    schema: OpenAPI.Document;
};

export class VCache {
    private static cache: Map<FileNameHash, CacheEntry> = new Map();

    public static get(hash: FileNameHash): CacheEntry | undefined {
        return VCache.cache.get(hash);
    }

    public static set(hash: FileNameHash, entry: CacheEntry) {
        VCache.cache.set(hash, entry);
    }

    public static setValidationState(hash: FileNameHash, state: boolean) {
        const entry = VCache.get(hash);
        if (!entry) {
            throw new Error(`Cache does not exist at all: ${hash}`);
        }
        entry.mustRevalidate = state;
        VCache.set(hash, entry); // this line is optional, just for readability
    }

    public static delete(hash: FileNameHash) {
        VCache.cache.delete(hash);
    }

    public static has(hash: FileNameHash): boolean {
        return VCache.cache.has(hash);
    }
}
