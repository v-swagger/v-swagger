import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { RewriteConfig } from '../types';

type RewriteRule = { regex: RegExp; value: string };
export class PathRewriter {
    private rewriteRules: RewriteRule[];
    private refSet: Set<string> = new Set();
    constructor(rewriteConfig: RewriteConfig, readonly fileName: string) {
        this.rewriteRules = this.parseRewriteRules(rewriteConfig);
    }

    public isApplicable(): boolean {
        return this.rewriteRules.length > 0;
    }

    // apply path rewrite rules firstly and resolve relative url to absolute url
    public rewrite(schema: OpenAPI.Document): OpenAPI.Document {
        return _.mergeWith({}, schema, (never: never, ref: string, key: string) => {
            let rewritten: string = ref;

            if (key === '$ref' && !ref.startsWith('#/')) {
                // TBD: apply all rules or only apply one of them?
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
            } else {
                // undefined uses default merge handling - used for all others properties
                return undefined;
            }
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
