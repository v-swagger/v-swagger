import { TextEditor } from 'vscode';
import { getActivatedFileName, hashFileName, isExternal$Ref } from '../../utils/fileUtil';

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
        expect(isExternal$Ref('$ref', '../catalog-shared/x.yaml#/path/to/User')).toBeTruthy();
        expect(isExternal$Ref('name', '../catalog-shared/x.yaml#/path/to/User')).toBeFalsy();
        expect(isExternal$Ref('$ref', '#/path/to/User')).toBeFalsy();
    });
});
