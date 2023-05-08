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
