import assert from 'assert';
import * as crypto from 'crypto';
import express from 'express';
import * as _ from 'lodash';
import * as os from 'os';
import { NetworkInterfaceInfo } from 'os';
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
    return normalizePath(editor.document.fileName);
}

/**
 * Normalize file path to follow posix style.  Specifically, replace \ to /.
 * e.g.
 *     c:\path\to/pet.yaml#components\schema/Pet -> c:/path/to/pet.yaml#components/schema/Pet
 * @param fileName
 * @returns
 */
export function normalizePath(fileName: string): string {
    return fileName.replace(/\\/g, path.posix.sep);
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

/**
 * Determine whether cache revalidation is required according to HTTP cache relevant headers.
 * @param headers The HTTP headers object from the Express request.
 * @returns A boolean indicating whether cache revalidation is required.
 */
export function isRevalidationRequired(headers: express.Request['headers']): boolean {
    // Extract the cache-relevant headers
    const {
        'cache-control': cacheControl, // HTTP/1.1
        pragma: pragma, // HTTP/1.0
    } = headers;

    // According to https://tools.ietf.org/html/rfc2616#section-14.9.4
    // must-revalidate is not considered. I think that's scoped out in this project.
    const hasCacheControlNoCache = cacheControl?.includes('no-cache');
    const hasCacheControlMaxAgeZero = cacheControl?.includes('max-age=0');
    const hasPragmaNoCache = pragma === 'no-cache';

    // Determine if cache revalidation is required
    return hasCacheControlNoCache || hasCacheControlMaxAgeZero || hasPragmaNoCache;
}

/**
 *  Check if the current workspace is a remote workspace
 * @returns
 */
export function isRemoteWorkspace(workspaceFolders: readonly vscode.WorkspaceFolder[] = []): boolean {
    return workspaceFolders?.length > 0 && workspaceFolders[0].uri.scheme === 'remote';
}

/**
 * get a public ipv4 address of remote workspace. If cannot get such a valid workspace, fallback to '0.0.0.0'.
 */
export function getExternalAddress(): string {
    const intfsMap: NodeJS.Dict<NetworkInterfaceInfo[]> = os.networkInterfaces();
    for (const key of Object.keys(intfsMap)) {
        const intfs = intfsMap[key] ?? [];
        for (const intf of intfs) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof intf.family === 'string' ? 'IPv4' : 4;
            if (intf.family === familyV4Value && !intf.internal) {
                return intf.address;
            }
        }
    }
    return '0.0.0.0';
}
