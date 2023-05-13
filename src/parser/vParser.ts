import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'fs/promises';
import * as YAML from 'js-yaml';
import { IJsonSchema, OpenAPI } from 'openapi-types';
import { basename, dirname, resolve } from 'path';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VServer } from '../server/vServer';
import { FileNameHash, RewriteConfig } from '../types';
import { hashFileName } from '../utils/fileUtil';
import { PathRewriter } from './pathRewriter';

export class VParser {
    private rewrite: PathRewriter;
    constructor(rewriteConfig: RewriteConfig) {
        this.rewrite = new PathRewriter(rewriteConfig);
    }
    public async parse(fileName: string): Promise<vscode.Uri> {
        try {
            let activatedYaml = (await readFile(fileName)).toString();
            if (this.rewrite.isApplicable()) {
                activatedYaml = this.rewrite.rewrite(activatedYaml);
            }

            const schema = YAML.load(activatedYaml) as OpenAPI.Document;

            const parsedSchema = await this.dereference(schema, fileName);

            const hash = hashFileName(fileName);
            VCache.set(hash, parsedSchema);

            // todo: watch change & notify subscribers
            // this.registerFileChangeListener(fileName);
            return this.getPreviewUrl(fileName, hash);
        } catch (e) {
            console.error(`[v-parser]: gets an error when parsing yaml: %j`, e);
            throw e;
        }
    }

    private getPreviewUrl(fileName: string, hash: FileNameHash): vscode.Uri {
        const uri = vscode.Uri.joinPath(VServer.getInstance().getServerUri(), hash, basename(fileName));
        console.info(`[v-parser]: VServer serves page for %s at %s`, fileName, uri);
        return uri;
    }

    private async dereference(schema: OpenAPI.Document, fileName: string): Promise<OpenAPI.Document> {
        try {
            this.resolveRefs(schema as unknown as IJsonSchema, dirname(fileName));
            schema = await SwaggerParser.dereference(schema, {
                dereference: {
                    circular: true,
                },
            });
        } catch (e) {
            console.error(`[swagger-parser]: dereference failed due to %s`, e);
        }

        return schema;
    }

    private resolveRefs(schema: IJsonSchema, basePath: string) {
        if (typeof schema !== 'object') {
            return;
        }

        for (const [key, value] of Object.entries(schema)) {
            if (key === '$ref') {
                // fixme: maybe apply rewrite rules here?
                schema[key] = this.resolveRefPath(basePath, value);
            } else {
                this.resolveRefs(value, basePath);
            }
        }
    }

    private resolveRefPath(basePath: string, ref: string) {
        if (ref.startsWith('#/')) {
            return ref;
        } else {
            console.info(`[swagger-parser]: resolving path -> %s`, ref);
            return resolve(basePath, ref);
        }
    }
}
