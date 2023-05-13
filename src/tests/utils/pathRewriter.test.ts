import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'fs/promises';
import path from 'path';
import { PathRewriter } from '../../parser/pathRewriter';

describe('test pathRewriter', () => {
    it('should apply rewrite rules correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const pathRewriter = new PathRewriter({ '@sap/deepsea-catalog-shared': '../../catalog-shared' }, '');
        expect(pathRewriter.isApplicable()).toBeTruthy();
        const resolvedPath = path.resolve(__dirname, '../../../src/tests/utils');
        const inputText = await (await readFile(path.join(resolvedPath, 'input.yaml'))).toString();
        const expectedText = await (await readFile(path.join(resolvedPath, 'output.yaml'))).toString();
        const replacedText = pathRewriter.rewrite(await SwaggerParser.parse(inputText));

        expect(replacedText).toBe(expectedText);
    });

    it('path rewrite is not applicable', () => {
        const pathRewriter = new PathRewriter({}, '');
        expect(pathRewriter.isApplicable()).toBeFalsy();
    });
});
