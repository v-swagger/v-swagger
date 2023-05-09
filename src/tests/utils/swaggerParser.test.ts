import path from 'path';
import { hashFileName } from '../../utils/fileUtil';
import { PathRewriter } from '../../utils/pathRewriter';
import { SwaggerParser } from '../../utils/swaggerParser';
import inputJson from './input.schema.json';

describe('test pathRewriter', () => {
    const isApplicableSpy = jest.spyOn(PathRewriter.prototype, 'isApplicable');

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });
    it('should parse swagger definition to json schema', async () => {
        isApplicableSpy.mockReturnValue(false);
        const swaggerParser = new SwaggerParser({});
        const fileName = path.resolve(__dirname, '../../../src/tests/utils/input.yaml');
        await swaggerParser.parse(fileName);
        const hash = hashFileName(fileName);
        expect(swaggerParser.getByFileNameHash(hash)).toEqual(inputJson);
        expect(isApplicableSpy).toBeCalledTimes(1);
    });
});
