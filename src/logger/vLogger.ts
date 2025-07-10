import * as util from 'util';
import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

class VLogger {
    private static instance: VLogger;
    private logOutputChannel: vscode.LogOutputChannel;
    private logLevel: LogLevel = LogLevel.DEBUG; // Default level

    private constructor() {
        this.logOutputChannel = vscode.window.createOutputChannel('V-Swagger', { log: true });
    }

    public static getInstance(): VLogger {
        if (!VLogger.instance) {
            VLogger.instance = new VLogger();
        }
        return VLogger.instance;
    }

    public setLogLevel(level: LogLevel) {
        this.logLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = Object.values(LogLevel);
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    public debug(message: string, ...args: any[]) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.logOutputChannel.debug(util.format(message, ...args));
        }
    }

    public info(message: string, ...args: any[]) {
        if (this.shouldLog(LogLevel.INFO)) {
            this.logOutputChannel.info(util.format(message, ...args));
        }
    }

    public warn(message: string, ...args: any[]) {
        if (this.shouldLog(LogLevel.WARN)) {
            this.logOutputChannel.warn(util.format(message, ...args));
        }
    }

    public error(message: string, error?: unknown, ...args: any[]) {
        if (this.shouldLog(LogLevel.ERROR)) {
            this.logOutputChannel.error(util.format(message, ...args));

            if (error) {
                const errorMessage =
                    error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);

                if (errorMessage) {
                    this.logOutputChannel.error(`Error details: ${errorMessage}`);
                }
            }
        }
    }

    public show() {
        this.logOutputChannel.show(true);
        this.showWelcomeMessage();
    }

    private showWelcomeMessage() {
        this.logOutputChannel.appendLine('----------------------------------------');
        this.logOutputChannel.appendLine('V-Swagger Extension');
        this.logOutputChannel.appendLine('----------------------------------------');
    }

    public hide() {
        this.logOutputChannel.hide();
    }

    public clear() {
        this.logOutputChannel.clear();
    }
}

export const logger = VLogger.getInstance();
