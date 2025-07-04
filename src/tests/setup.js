// Set up VSCode mock
jest.mock('vscode', () => require('./utils/mocks/vscode'), { virtual: true });
