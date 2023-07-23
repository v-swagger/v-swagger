import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { RewriteConfig } from '../types';
import { REF_HASH_SEPARATOR, isInternal$Ref, isValid$Ref, normalize$Ref, normalizePath } from '../utils/utils';

type RewriteRule = { regex: RegExp; value: string };
export class PathRewriter {
    private rewriteRules: RewriteRule[];
    private refSet: Set<string> = new Set();
    constructor(rewriteConfig: RewriteConfig, readonly fileName: string) {
        this.rewriteRules = this.parseRewriteRules(rewriteConfig);
    }

    /**
     * apply path rewrite rules firstly and resolve relative url to absolute url
     * Note: on Windows, both the forward slash (/) and backward slash (\) are accepted as path segment separators;
     * however, the path methods only add backward slashes (\).
     * the resolved path looks like:
     *  - on Windows: "D:\\catalog-shared\\spec\\catalog-shared.yaml#\\components\\responses\\Unauthorized" on Windows
     *  - on POSIX: "/catalog-shared/spec/catalog-shared.yaml#/components/responses/Unauthorized"
     * @param schema
     * @returns
     */
    public rewrite(schema: OpenAPI.Document): OpenAPI.Document {
        return _.mergeWith({}, schema, (never: never, ref: string, key: string) => {
            let rewritten: string = ref;

            if (!isValid$Ref(key, ref) || isInternal$Ref(key, ref)) {
                // undefined uses default merge handling - used for all others properties
                return undefined;
            }

            for (const rule of this.rewriteRules) {
                rewritten = rewritten.replace(rule.regex, rule.value);
            }
            console.info(`[v-rewriter]: resolving path -> %s`, rewritten);
            const dir = path.dirname(this.fileName);
            const fullPath = normalizePath(path.join(dir, rewritten));
            const { absolutePath, hashPath } = normalize$Ref(fullPath);
            const isInternal = absolutePath === this.fileName;
            console.info(
                `[v-rewriter]: fullPath: %s, \n absolutePath: %s, \n hashPath: %s, \n fileName: %s`,
                fullPath,
                absolutePath,
                hashPath,
                this.fileName
            );
            if (!isInternal) {
                // collect all references
                this.refSet.add(absolutePath);
            }

            return isInternal ? `${REF_HASH_SEPARATOR}${hashPath}` : fullPath;
        });
    }

    public getAllRefs(): string[] {
        return [...this.refSet];
    }

    private parseRewriteRules(rewriteConfig: RewriteConfig): RewriteRule[] {
        const rules: RewriteRule[] = [];

        for (const [key, value] of Object.entries(rewriteConfig)) {
            rules.push({
                regex: new RegExp(key),
                value: value,
            });
            console.info('[path-rewriter]: rewrite rule created: "%s" -> "%s"', key, value);
        }

        return rules;
    }
}
