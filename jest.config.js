export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/?(*.)+(spec|test).[j]s?(x)'],
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
};
