import { readFile } from 'fs/promises';
import * as YAML from 'js-yaml';
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
            const content = YAML.load(activatedYaml) as object;
            const hash = hashFileName(fileName);
            this.cache.set(hash, content);
        } catch (e) {
            console.error(`get an error when parsing yaml: %j`, e);
            throw e;
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
