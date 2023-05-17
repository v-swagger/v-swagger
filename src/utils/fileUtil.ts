import assert from 'assert';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import { Normalized$Ref } from '../types';

// only supports #/ in the Swagger definition
export const REF_HASH_SEPARATOR = `#${path.posix.sep}`;

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

/**
 * check whether the given key-value pair is a valid reference.
 * A valid reference must contain a hash separator `#/` no matter
 * it is a internal reference or external reference.
 * @param key
 * @param ref
 * @returns
 */
export function isValid$Ref(key: string, ref: unknown): ref is string {
    return _.isString(ref) && key === '$ref' && ref.includes(REF_HASH_SEPARATOR);
}

/**
 * check whether the give key, value is an external reference key-value pair
 * @param key
 * @param ref
 * @returns
 */
export function isInternal$Ref(key: string, ref: unknown): ref is string {
    return isValid$Ref(key, ref) && ref.startsWith(REF_HASH_SEPARATOR);
}

/**
 * Normalize the reference. returns an object including absolute path and hash path
 * The invalid reference must contain `#/` following a non-empty string
 * indicating the referenced path. Missing hash string is not allowed.
 * e.g. /path/to/system.yaml#/ is invalid
 * @param fullPath
 * @returns
 */
export function normalize$Ref(fullPath: string): Normalized$Ref {
    const components = fullPath.split(REF_HASH_SEPARATOR);
    if (components.length !== 2) {
        throw new Error(`invalid reference: ${fullPath}`);
    }
    if (components[1] === '') {
        throw new Error(`reference to whole schema is not supported: ${fullPath}`);
    }
    return {
        absolutePath: components[0],
        hashPath: components[1],
    };
}
