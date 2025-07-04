import * as path from 'path';
import {
    ErrorContext,
    IFileErrorContext,
    IPathRewriteErrorContext,
    IReferenceErrorContext,
    ISchemaErrorContext,
} from '../types';

/**
 * Error categories to help users identify the source of the problem
 */
export enum ErrorCategory {
    PathRewrite = 'Path Rewrite Error',
    SchemaValidation = 'Schema Validation Error',
    ReferenceResolution = 'Reference Resolution Error',
    FileNotFound = 'File Not Found Error',
    Unknown = 'Unknown Error',
}

/**
 * Enhanced error class with additional context for better error messages
 * Extends Error to be throwable while preserving all enhanced properties
 */
export class VError extends Error {
    readonly category: ErrorCategory;
    readonly originalError: Error;
    readonly filePath?: string;
    readonly suggestion?: string;
    readonly details?: Record<string, any>;

    constructor(
        originalError: Error,
        message: string,
        category: ErrorCategory,
        filePath?: string,
        suggestion?: string,
        details?: Record<string, any>
    ) {
        super(message);
        this.name = 'VError';
        this.originalError = originalError;
        this.category = category;
        this.filePath = filePath;
        this.suggestion = suggestion;
        this.details = details;

        // Preserve original stack trace
        if (originalError.stack) {
            this.stack = originalError.stack;
        }
    }

    /**
     * Format the error into a user-friendly message
     */
    format(): string {
        let message = `[${this.category}] ${this.message}`;

        if (this.filePath) {
            message += `\n\nFile: ${this.filePath}`;
        }

        if (this.suggestion) {
            message += `\n\nSuggestion: ${this.suggestion}`;
        }

        if (this.details) {
            const detailsStr = Object.entries(this.details)
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join('\n');

            if (detailsStr) {
                message += `\n\nDetails:\n${detailsStr}`;
            }
        }

        return message;
    }
}

export class ErrorHandler {
    /**
     * Process an error and enhance it with more context and suggestions
     */
    public static processError(error: Error, contextInfo?: ErrorContext): VError {
        // Try to categorize and enhance the error
        if (this.isFileNotFoundError(error)) {
            return this.processFileNotFoundError(error, contextInfo as IFileErrorContext);
        } else if (this.isPathRewriteError(error, contextInfo)) {
            return this.processPathRewriteError(error, contextInfo as IPathRewriteErrorContext);
        } else if (this.isSchemaValidationError(error)) {
            return this.processSchemaValidationError(error, contextInfo as ISchemaErrorContext);
        } else if (this.isReferenceResolutionError(error)) {
            return this.processReferenceResolutionError(error, contextInfo as IReferenceErrorContext);
        }

        // Default enhanced error
        return new VError(error, error.message, ErrorCategory.Unknown, undefined, undefined, contextInfo);
    }

    /**
     * Check if the error is a file not found error
     */
    private static isFileNotFoundError(error: Error): boolean {
        return (
            error.message.includes('ENOENT') ||
            error.message.includes('no such file') ||
            error.message.toLowerCase().includes('file not found')
        );
    }

    /**
     * Check if the error is related to path rewriting
     */
    private static isPathRewriteError(error: Error, contextInfo?: ErrorContext): boolean {
        // If we have applied rules in the context, consider it a path rewrite issue
        if (
            contextInfo?.appliedRules &&
            Array.isArray(contextInfo.appliedRules) &&
            contextInfo.appliedRules.length > 0
        ) {
            return true;
        }

        // Otherwise, check if it's a file not found error that might be related to path rewriting
        return (
            this.isFileNotFoundError(error) &&
            (contextInfo?.originalPath !== undefined || contextInfo?.rewrittenPath !== undefined)
        );
    }

    /**
     * Check if the error is a schema validation error
     */
    private static isSchemaValidationError(error: Error): boolean {
        return (
            error.message.includes('invalid schema') ||
            error.message.includes('schema validation') ||
            error.message.includes('not a valid')
        );
    }

    /**
     * Check if the error is related to reference resolution
     */
    private static isReferenceResolutionError(error: Error): boolean {
        return (
            error.message.includes('$ref') ||
            error.message.includes('reference') ||
            error.message.includes('resolving') ||
            error.message.includes('circular')
        );
    }

    /**
     * Process file not found errors
     */
    private static processFileNotFoundError(error: Error, contextInfo?: IFileErrorContext): VError {
        const filePath = this.extractFilePath(error.message);
        const message = `Could not find file: ${filePath || 'unknown file'}${contextInfo?.referenceValue ? `\nReference: ${contextInfo.referenceValue}` : ''}`;
        const suggestion = 'Verify that the file exists at the specified location.';

        return new VError(error, message, ErrorCategory.FileNotFound, filePath, suggestion, contextInfo);
    }

    /**
     * Process path rewrite errors
     */
    private static processPathRewriteError(error: Error, contextInfo?: IPathRewriteErrorContext): VError {
        const filePath = this.extractFilePath(error.message);
        const appliedRules = contextInfo?.appliedRules || [];

        let suggestion = 'Check your path rewrite configuration. ';

        if (appliedRules.length > 0) {
            suggestion += 'The following rewrite rules were applied:\n';
            appliedRules.forEach((rule) => {
                suggestion += `- Pattern: ${rule.regex.toString()} → ${rule.value}\n`;
            });

            if (contextInfo?.originalPath && contextInfo?.rewrittenPath) {
                suggestion += `\nOriginal path: ${contextInfo.originalPath}\n`;
                suggestion += `Rewritten to: ${contextInfo.rewrittenPath}\n`;
                suggestion += '\nThis rewritten path could not be found.';
            }
        } else {
            suggestion += 'No rewrite rules matched your path.';
        }

        const message = `Failed to resolve file due to path rewrite issues: ${filePath || 'unknown file'}${contextInfo?.referenceValue ? `\nReference: ${contextInfo.referenceValue}` : ''}`;

        return new VError(error, message, ErrorCategory.PathRewrite, filePath, suggestion, contextInfo);
    }

    /**
     * Process schema validation errors
     */
    private static processSchemaValidationError(error: Error, contextInfo?: ISchemaErrorContext): VError {
        const message = `OpenAPI schema validation failed: ${error.message}${contextInfo?.referenceValue ? `\nReference: ${contextInfo.referenceValue}` : ''}`;
        const suggestion =
            'Check your OpenAPI specification against the official specification. Common issues include incorrect data types, missing required fields, or invalid format.';

        return new VError(
            error,
            message,
            ErrorCategory.SchemaValidation,
            contextInfo?.fileName,
            suggestion,
            contextInfo
        );
    }

    /**
     * Process reference resolution errors
     */
    private static processReferenceResolutionError(error: Error, contextInfo?: IReferenceErrorContext): VError {
        const message = `Failed to resolve references: ${error.message}${contextInfo?.referenceValue ? `\nReference: ${contextInfo.referenceValue}` : ''}`;
        const suggestion =
            'Verify that all references ($ref) in your OpenAPI definition point to valid locations. Check for typos in paths and confirm that referenced files exist.';

        return new VError(
            error,
            message,
            ErrorCategory.ReferenceResolution,
            contextInfo?.fileName,
            suggestion,
            contextInfo
        );
    }

    /**
     * Extract a file path from an error message
     */
    private static extractFilePath(message: string): string | undefined {
        // Look for file paths in the error message
        const filePathRegex = /'([^']+)'/;
        const match = message.match(filePathRegex);

        if (match && match[1]) {
            return match[1];
        }

        // Try another common pattern
        const quotedPathRegex = /"([^"]+)"/;
        const quotedMatch = message.match(quotedPathRegex);

        if (quotedMatch && quotedMatch[1] && quotedMatch[1].includes(path.sep)) {
            return quotedMatch[1];
        }

        return undefined;
    }
}
