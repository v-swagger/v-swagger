import { OpenAPI } from 'openapi-types';

export class VCache {
    private static cache: Map<string, OpenAPI.Document> = new Map();

    public static get(hash: string): OpenAPI.Document | undefined {
        return VCache.cache.get(hash);
    }
    public static set(hash: string, value: OpenAPI.Document) {
        VCache.cache.set(hash, value);
    }
}
