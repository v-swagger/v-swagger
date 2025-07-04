import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { logger } from '../logger/vLogger';
import { IPathRewriteErrorContext, RewriteConfig } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import { REF_HASH_SEPARATOR, isInternal$Ref, isValid$Ref, normalize$Ref, normalizePath } from '../utils/utils';

export type RewriteRule = { regex: RegExp; value: string };
export class PathRewriter {
    private rewriteRules: RewriteRule[];
    private refSet: Set<string> = new Set();
    constructor(
        rewriteConfig: RewriteConfig,
        readonly fileName: string
    ) {
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
    /**
     * Tracks which rules were applied to a reference for better error reporting
     */
    private rewriteReference(ref: string): { rewritten: string; appliedRules: RewriteRule[] } {
        logger.debug('[PathRewriter] Rewriting reference: %s', ref);
        let rewritten = ref;
        const appliedRules: RewriteRule[] = [];

        for (const rule of this.rewriteRules) {
            const beforeRewrite = rewritten;
            rewritten = rewritten.replace(rule.regex, rule.value);

            // If the path was changed by this rule, add it to appliedRules
            if (beforeRewrite !== rewritten) {
                logger.debug(
                    '[PathRewriter] Rule applied: %s -> %s (result: %s)',
                    rule.regex.toString(),
                    rule.value,
                    rewritten
                );
                appliedRules.push(rule);
            }
        }

        if (appliedRules.length > 0) {
            logger.info('[PathRewriter] Reference rewritten from %s to %s', ref, rewritten);
        } else {
            logger.debug('[PathRewriter] No rules applied to reference: %s', ref);
        }

        return { rewritten, appliedRules };
    }

    public rewrite(schema: OpenAPI.Document): OpenAPI.Document {
        return _.mergeWith({}, schema, (never: never, ref: string, key: string) => {
            if (!isValid$Ref(key, ref) || isInternal$Ref(key, ref)) {
                // undefined uses default merge handling - used for all others properties
                return undefined;
            }

            const { rewritten, appliedRules } = this.rewriteReference(ref);

            logger.info('[PathRewriter] Resolving path -> %s', rewritten);
            const dir = path.dirname(this.fileName);
            const fullPath = normalizePath(path.join(dir, rewritten));

            try {
                const { absolutePath, hashPath } = normalize$Ref(fullPath);
                const isInternal = absolutePath === this.fileName;
                logger.debug(
                    '[PathRewriter] Path resolution details: fullPath: %s, absolutePath: %s, hashPath: %s, fileName: %s',
                    fullPath,
                    absolutePath,
                    hashPath,
                    this.fileName
                );

                if (!isInternal) {
                    // collect all references
                    this.refSet.add(absolutePath);
                    logger.debug('[PathRewriter] External reference added: %s', absolutePath);
                }

                return isInternal ? `${REF_HASH_SEPARATOR}${hashPath}` : fullPath;
            } catch (error) {
                // Process the error with ErrorHandler but still throw it
                const err = error as Error;
                const errorContext: IPathRewriteErrorContext = {
                    fileName: this.fileName,
                    originalPath: ref,
                    rewrittenPath: rewritten,
                    appliedRules: appliedRules,
                    fullPath: fullPath,
                    referenceValue: ref, // Include the original reference value
                };

                // Use ErrorHandler to process the error
                // Process the error to enhance it with context
                const vError = ErrorHandler.processError(err, errorContext);

                logger.error('[PathRewriter] Error resolving path: %s', err.message);

                // Throw the enhanced error directly
                throw vError;
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
            logger.info('[PathRewriter] Rewrite rule created: "%s" -> "%s"', key, value);
        }

        return rules;
    }
}
