import $RefParser from '@apidevtools/json-schema-ref-parser';
import { readFile } from 'fs/promises';
import * as YAML from 'js-yaml';
import { dirname, resolve } from 'path';
import { FileNameHash, RewriteConfig } from '../types';
import { hashFileName } from './fileUtil';
import { PathRewriter } from './pathRewriter';

export class SwaggerParser {
    private cache: Map<FileNameHash, object> = new Map();
    private rewrite: PathRewriter;
    constructor(rewriteConfig: RewriteConfig) {
        this.rewrite = new PathRewriter(rewriteConfig);
    }

    public async parse(fileName: string): Promise<void> {
        try {
            let activatedYaml = (await readFile(fileName)).toString();
            if (this.rewrite.isApplicable()) {
                activatedYaml = this.rewrite.rewrite(activatedYaml);
            }
            const schema = YAML.load(activatedYaml) as Record<string, string>;

            this.resolveRefs(schema, dirname(fileName));

            const content = await $RefParser.dereference(schema);
            const hash = hashFileName(fileName);
            this.cache.set(hash, content);
        } catch (e) {
            console.error(`get an error when parsing yaml: %j`, e);
            throw e;
        }
    }

    private resolveRefs(schema: Record<string, string>, basePath: string) {
        if (typeof schema !== 'object') {
            return;
        }

        for (const [key, value] of Object.entries(schema)) {
            if (key === '$ref') {
                // fixme: maybe apply rewrite rules here?
                schema[key] = this.resolveRefPath(basePath, value);
            } else {
                this.resolveRefs(value as unknown as Record<string, string>, basePath);
            }
        }
    }

    private resolveRefPath(basePath: string, ref: string) {
        if (ref.startsWith('#/')) {
            return ref;
        } else {
            return resolve(basePath, ref);
        }
    }

    /**
     * @param hash Server get parsed content by hash code. Content is parsed when preview is executing.
     * @returns
     */
    public getByFileNameHash(hash: FileNameHash): object | undefined {
        return this.cache.get(hash);
    }
}
