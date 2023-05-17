import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { RewriteConfig } from '../types';
import { isExternal$Ref } from '../utils/fileUtil';

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

            if (!isExternal$Ref(key, ref)) {
                // undefined uses default merge handling - used for all others properties
                return undefined;
            }

            for (const rule of this.rewriteRules) {
                rewritten = rewritten.replace(rule.regex, rule.value);
            }
            console.info(`[v-rewriter]: resolving path -> %s`, rewritten);
            const absoluteRef = path.resolve(path.dirname(this.fileName), rewritten);

            const hashIndex = absoluteRef.indexOf('#');
            if (hashIndex < 0) {
                console.error(`[v-rewriter]: invalid reference - %s`, rewritten);
            } else {
                // collect all references
                this.refSet.add(absoluteRef.slice(0, hashIndex));
            }

            return absoluteRef;
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
