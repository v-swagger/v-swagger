/* eslint-disable @typescript-eslint/naming-convention */
import { OpenAPI } from 'openapi-types';
import path from 'path';
import { PathRewriter } from '../../parser/pathRewriter';

describe('test pathRewriter', () => {
    it('should apply rewrite rules correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const pathRewriter = new PathRewriter(
            {
                '@pylon/0x400-catalog-shared': 'catalog-shared',
                'catalog-shared/spec/catalog-enrichment.yaml': 'catalog-enrichment/spec/enrichment.yaml',
            },
            '/'
        );
        const testSchema = {
            '401': {
                $ref: '@pylon/0x400-catalog-shared/spec/catalog-shared.yaml#/components/responses/Unauthorized',
            },
            '404': {
                $ref: '@pylon/0x400-catalog-shared/spec/catalog-shared.yaml#/components/responses/NotFound',
            },
            '500': {
                $ref: '@pylon/0x400-catalog-shared/spec/catalog-enrichment.yaml#/components/responses/InternalServerError',
            },
        } as unknown as OpenAPI.Document;

        const expectedSchema = {
            '401': {
                $ref: path.posix.resolve('/catalog-shared/spec/catalog-shared.yaml#/components/responses/Unauthorized'),
            },
            '404': {
                $ref: path.posix.resolve('/catalog-shared/spec/catalog-shared.yaml#/components/responses/NotFound'),
            },
            '500': {
                $ref: path.posix.resolve(
                    '/catalog-enrichment/spec/enrichment.yaml#/components/responses/InternalServerError'
                ),
            },
        } as unknown as OpenAPI.Document;
        const rewrittenSchema = pathRewriter.rewrite(testSchema);
        expect(rewrittenSchema).toEqual(expectedSchema);
        expect(pathRewriter.getAllRefs().sort()).toEqual(
            [
                path.posix.resolve('/catalog-enrichment/spec/enrichment.yaml'),
                path.posix.resolve('/catalog-shared/spec/catalog-shared.yaml'),
            ].sort()
        );
    });
});
