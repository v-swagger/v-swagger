/* eslint-disable @typescript-eslint/naming-convention */
import { OpenAPI } from 'openapi-types';
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
                $ref: '/catalog-shared/spec/catalog-shared.yaml#/components/responses/Unauthorized',
            },
            '404': {
                $ref: '/catalog-shared/spec/catalog-shared.yaml#/components/responses/NotFound',
            },
            '500': {
                $ref: '/catalog-enrichment/spec/enrichment.yaml#/components/responses/InternalServerError',
            },
        } as unknown as OpenAPI.Document;
        const rewrittenSchema = pathRewriter.rewrite(testSchema);
        expect(rewrittenSchema).toEqual(expectedSchema);
    });
});
