import { readFile } from 'fs/promises';
import * as YAML from 'js-yaml';
import { FileNameHash } from '../types';
import { hashFileName } from '../utils/FileUtil';

export class VSwaggerParser {
    private cache: Map<FileNameHash, object> = new Map();
    private static instance: VSwaggerParser;
    public static getInstance(): VSwaggerParser {
        if (!VSwaggerParser.instance) {
            VSwaggerParser.instance = new VSwaggerParser();
        }
        return VSwaggerParser.instance;
    }

    // todo: use it later
    public async getSwaggerObject(fileNameHash: FileNameHash, fileName: string) {
        return this.cache.get(fileNameHash) ?? (await this.parse(fileName));
    }

    public async parse(fileName: string): Promise<void> {
        // todo: reuse file hash code
        try {
            const activatedYaml = (await readFile(fileName)).toString();
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
