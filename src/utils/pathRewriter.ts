import { RewriteConfig } from '../types';

type RewriteRule = { regex: RegExp; value: string };
export class PathRewriter {
    private rewriteRules: RewriteRule[];
    constructor(rewriteConfig: RewriteConfig) {
        this.rewriteRules = this.parseRewriteRules(rewriteConfig);
    }

    public isApplicable(): boolean {
        return this.rewriteRules.length > 0;
    }

    public rewrite(plainYaml: string): string {
        let replacedYaml: string = plainYaml;

        for (const rule of this.rewriteRules) {
            // Define a regular expression that matches the text only if it's after `$ref:`
            const regex = new RegExp(`(^\\s*\\$ref:\\s*.*${rule.regex.source})`, 'gm');
            replacedYaml = replacedYaml.replace(regex, (_, p1) => {
                console.info('rewriter: applying rewrite rules: "%s" -> "%s"', rule.regex, rule.value);
                // Replace the matched text only if it's after `$ref:`
                return `${p1.replace(rule.regex, rule.value)}`;
            });
        }

        return replacedYaml;
    }

    private parseRewriteRules(rewriteConfig: RewriteConfig): RewriteRule[] {
        const rules: RewriteRule[] = [];

        for (const [key, value] of Object.entries(rewriteConfig)) {
            rules.push({
                regex: new RegExp(key),
                value: value,
            });
            console.info('rewriter: rewrite rule created: "%s" ~> "%s"', key, value);
        }

        return rules;
    }
}
