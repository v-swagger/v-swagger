import { OpenAPI } from 'openapi-types';
import { FileNameHash } from '../types';

export class VCache {
    private static cache: Map<FileNameHash, OpenAPI.Document> = new Map();

    public static get(hash: FileNameHash): OpenAPI.Document | undefined {
        return VCache.cache.get(hash);
    }
    public static set(hash: FileNameHash, value: OpenAPI.Document) {
        VCache.cache.set(hash, value);
    }

    public static delete(hash: FileNameHash) {
        VCache.cache.delete(hash);
    }

    public static has(hash: FileNameHash): boolean {
        return VCache.cache.has(hash);
    }
}
