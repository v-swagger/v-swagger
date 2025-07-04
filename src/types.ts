export type FileNameHash = string;

export interface IPreviewer {
    preview(): Promise<void>;
}

export type RewriteConfig = Record<string, string>;

export type $RefSchema = { $ref?: string };

export type Normalized$Ref = { absolutePath: string; hashPath: string };

export type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

export enum WebSocketEvents {
    Connection = 'connection',
    Load = 'load',
    Push = 'push',
}

/**
 * Operation related error context
 */
export interface IOperationErrorContext extends IBaseErrorContext {
    operation?: string; // The operation being performed (e.g., 'file preview')
    fileNameHash?: string; // The hash of the file for operations
    basename?: string; // The base name of the file for operations
}

/**
 * Combined error context interface for backward compatibility
 */
export type ErrorContext = IBaseErrorContext &
    Partial<IFileErrorContext> &
    Partial<IReferenceErrorContext> &
    Partial<IPathRewriteErrorContext> &
    Partial<ISchemaErrorContext> &
    Partial<IOperationErrorContext>;

/**
 * Base error context interface with common properties
 */
export interface IBaseErrorContext {
    fileName?: string; // The file where the error occurred
}

/**
 * File error context for file not found or access errors
 */
export interface IFileErrorContext extends IBaseErrorContext {
    fileHash?: string; // The hash of the file
    baseFileName?: string; // The base name of the file
    referenceValue?: string; // The reference that points to this file
}

/**
 * Reference error context for reference resolution errors
 */
export interface IReferenceErrorContext extends IBaseErrorContext {
    referenceValue?: string; // The original reference value ($ref)
    sourceFile?: string; // The source file containing the reference
    referenceType?: string; // The type of reference (e.g., external)
}

/**
 * Path rewrite error context for rewrite rule errors
 */
export interface IPathRewriteErrorContext extends IBaseErrorContext {
    originalPath?: string; // The original path before rewriting
    rewrittenPath?: string; // The path after rewrite rules are applied
    appliedRules?: any[]; // The rewrite rules that were applied
    fullPath?: string; // The full resolved path
    referenceValue?: string; // The original reference value
}

/**
 * Schema error context for schema validation errors
 */
export interface ISchemaErrorContext extends IBaseErrorContext {
    schemaType?: string; // The type of schema (e.g., OpenAPI)
    referenceValue?: string; // The reference that caused validation issues
}
