/* eslint-disable @typescript-eslint/naming-convention */
import { TextEditor } from 'vscode';
import {
    getActivatedFileName,
    hashFileName,
    isRevalidationRequired,
    isValid$Ref,
    REF_HASH_SEPARATOR,
} from '../../utils/fileUtil';

describe('test fileUtils', () => {
    it('should get an hash string', () => {
        expect(hashFileName('/path/to/file.yaml').length).toBe(8);
    });

    it('should get activated file name', () => {
        const expFileName = 'pet.yaml';
        const mockedEditor = {
            document: {
                fileName: expFileName,
            },
        } as unknown as TextEditor;

        expect(getActivatedFileName(mockedEditor)).toBe(expFileName);
    });

    it('should throw an error if editor is undefined', () => {
        expect(() => getActivatedFileName()).toThrow();
    });

    it('should check whether it is an external url correctly', () => {
        expect(isValid$Ref('$ref', `./catalog-shared/x.yaml${REF_HASH_SEPARATOR}path/to/User`)).toBeTruthy();
        expect(isValid$Ref('name', `./catalog-shared/x.yaml${REF_HASH_SEPARATOR}path/to/User`)).toBeFalsy();
        expect(isValid$Ref('$ref', `${REF_HASH_SEPARATOR}path/to/User`)).toBeTruthy();
        expect(isValid$Ref('$ref', `path/to/User`)).toBeFalsy();
        expect(isValid$Ref('$ref', {})).toBeFalsy();
        expect(
            isValid$Ref('$ref', `c:\\Users\\pylon\\spec\\${REF_HASH_SEPARATOR}components\\schemas\\AllSystemsResponse`)
        ).toBeTruthy();
    });

    it('should check whether cache needs revalidation', () => {
        expect(isRevalidationRequired({})).toBe(false);
        expect(isRevalidationRequired({ 'cache-control': 'no-cache' })).toBe(true); // Reload page
        expect(isRevalidationRequired({ 'cache-control': 'max-age=0' })).toBe(true); // Refresh
        expect(isRevalidationRequired({ pragma: 'no-cache' })).toBe(true); // HTTP/1.0
    });
});
