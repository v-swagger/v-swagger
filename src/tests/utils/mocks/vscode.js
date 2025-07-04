// Mock VSCode APIs used in the project
const vscode = {
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            clear: jest.fn(),
        }),
    },
    Uri: {
        file: jest.fn((path) => ({ path })),
        parse: jest.fn((url) => ({ url })),
    },
    RelativePattern: jest.fn(),
    workspace: {
        createFileSystemWatcher: jest.fn().mockReturnValue({
            onDidChange: jest.fn(),
            dispose: jest.fn(),
        }),
        getConfiguration: jest.fn().mockReturnValue({}),
    },
    env: {
        openExternal: jest.fn(),
    },
    ProgressLocation: {
        Notification: 1,
    },
};

module.exports = vscode;
