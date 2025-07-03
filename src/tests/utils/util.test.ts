import os from 'os';
import * as path from 'path';
import { TextEditor } from 'vscode';
import {
    REF_HASH_SEPARATOR,
    getActivatedFileName,
    getExternalAddress,
    hashFileName,
    isRevalidationRequired,
    isValid$Ref,
    normalizePath,
} from '../../utils/utils';

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

    it('should normalize path', () => {
        expect(normalizePath('/root/my-dir/a.yaml#xx')).toBe('/root/my-dir/a.yaml#xx');
        expect(normalizePath(`c:${path.win32.sep}my-dir\\b.yaml`)).toBe('c:/my-dir/b.yaml');
    });

    describe('getExternalAddress', () => {
        let networkInterfacesSpy: jest.SpyInstance;
        beforeAll(() => {
            networkInterfacesSpy = jest.spyOn(os, 'networkInterfaces').mockImplementation();
        });

        afterAll(() => {
            networkInterfacesSpy.mockRestore();
        });

        it('should return a valid IPv4 address', () => {
            networkInterfacesSpy.mockReturnValue({
                lo0: [
                    {
                        address: '127.0.0.1',
                        netmask: '255.0.0.0',
                        family: 'IPv4',
                        mac: '00:00:00:00:00:00',
                        internal: true,
                        cidr: '127.0.0.1/8',
                    },
                ],
                ap1: [
                    {
                        address: 'fe80::7ce9:1eff:feae:a71d',
                        netmask: 'ffff:ffff:ffff:ffff::',
                        family: 'IPv6',
                        mac: '7e:e9:1e:ae:a7:1d',
                        internal: false,
                        cidr: 'fe80::7ce9:1eff:feae:a71d/64',
                        scopeid: 13,
                    },
                ],
                en0: [
                    {
                        address: 'fe80::41d:9b98:a6ca:b852',
                        netmask: 'ffff:ffff:ffff:ffff::',
                        family: 'IPv6',
                        mac: '5c:e9:1e:ae:a7:1d',
                        internal: false,
                        cidr: 'fe80::41d:9b98:a6ca:b852/64',
                        scopeid: 14,
                    },
                    {
                        address: '192.168.2.3',
                        netmask: '255.255.255.0',
                        family: 'IPv4',
                        mac: '5c:e9:1e:ae:a7:1d',
                        internal: false,
                        cidr: '192.168.2.3/24',
                    },
                ],
            } as unknown as NodeJS.Dict<os.NetworkInterfaceInfo[]>);
            const address = getExternalAddress();
            expect(address).toBe('192.168.2.3');
        });
        it('should fallback to 0.0.0.0 if no valid IPv4 address found', () => {
            networkInterfacesSpy.mockReturnValue({
                lo0: [
                    {
                        address: '127.0.0.1',
                        netmask: '255.0.0.0',
                        family: 'IPv4',
                        mac: '00:00:00:00:00:00',
                        internal: true,
                        cidr: '127.0.0.1/8',
                    },
                ],
            } as unknown as NodeJS.Dict<os.NetworkInterfaceInfo[]>);
            const address = getExternalAddress();
            expect(address).toBe('0.0.0.0');
        });
    });
});
