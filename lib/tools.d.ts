import type { AuthMode, GDriveAuth } from './auth.js';
import type { GClient } from './gclient.js';
export interface ToolsDeps {
    auth: GDriveAuth;
    client: GClient;
    cfg: {
        mode: AuthMode;
        pageSize: number;
        maxChars: number;
    };
}
export declare function createTools(deps: ToolsDeps): import("@deepseek-ai/dsh-tools").ToolDefinition[];
