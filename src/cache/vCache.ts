import { OpenAPI } from 'openapi-types';

export class VCache {
    private static cache: Map<string, OpenAPI.Document> = new Map();

    public static get(hash: string): OpenAPI.Document | undefined {
        return VCache.cache.get(hash);
    }
    public static set(hash: string, value: OpenAPI.Document) {
        VCache.cache.set(hash, value);
    }

    public static delete(hash: string) {
        VCache.cache.delete(hash);
    }

    public static has(hash: string): boolean {
        return VCache.cache.has(hash);
    }
}
