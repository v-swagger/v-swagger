import { readFile } from 'fs/promises';
import path from 'path';
import { PathRewriter } from '../../../src/utils/pathRewriter';

describe('test pathRewriter', () => {
    it('should apply rewrite rules correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const vPathRewriter = new PathRewriter({ '@sap/deepsea-catalog-shared': '../../catalog-shared' });
        expect(vPathRewriter.isApplicable()).toBeTruthy();
        const resolvedPath = path.resolve(__dirname, '../../../../test/unit/utils');
        const inputText = await (await readFile(path.join(resolvedPath, 'input.yaml'))).toString();
        const expectedText = await (await readFile(path.join(resolvedPath, 'output.yaml'))).toString();
        const replacedText = vPathRewriter.rewrite(inputText);

        expect(replacedText).toBe(expectedText);
    });

    it('path rewrite is not applicable', () => {
        const vPathRewriter = new PathRewriter({});
        expect(vPathRewriter.isApplicable()).toBeFalsy();
    });
});
