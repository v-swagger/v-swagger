import assert from 'assert';
import * as crypto from 'crypto';
import * as vscode from 'vscode';

export function hashFileName(fileName: string): string {
    return crypto.createHash('md5').update(fileName).digest('hex').slice(0, 8);
}

/**
 * get absolute file path. e.g. /path/to/pet.yaml
 */
export function getActivatedFileName(editor?: vscode.TextEditor) {
    assert(editor);
    return editor.document.fileName;
}

export const isObject = (value: unknown): value is object =>
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Boolean) &&
    !(value instanceof Date) &&
    !(value instanceof Number) &&
    !(value instanceof RegExp) &&
    !(value instanceof String);

const toPointer = (parts: string[]) =>
    '#' + parts.map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

export const decycle = () => {
    const paths = new WeakMap();

    return function replacer(this: JSON, key: string | symbol, value: unknown) {
        if (key !== '$ref' && isObject(value)) {
            const seen = paths.has(value);

            if (seen) {
                return { $ref: toPointer(paths.get(value)) };
            } else {
                paths.set(value, [...(paths.get(this) ?? []), key]);
            }
        }

        return value;
    };
};
