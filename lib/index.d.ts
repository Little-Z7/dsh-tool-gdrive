/**
 * dsh-tool-gdrive：DeepSeek Harness 的 Google 云端硬盘插件。
 * 读写闭环 + 工具内 OAuth 授权向导；token 只落本地文件，不进配置。
 * @module dsh-tool-gdrive
 */
import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import { type AuthMode } from './auth.js';
export declare const name = "gdrive";
export declare const inject: string[];
export interface PluginConfig {
    clientId?: string;
    clientSecret?: string;
    port: number;
    bridgePort: number;
    tokenPath: string;
    mode: AuthMode;
    maxChars: number;
    pageSize: number;
    timeoutMs: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    clientId: Schema<string, string, "plain">;
    clientSecret: Schema<string, string, "plain">;
    port: Schema<number, number, "defined">;
    bridgePort: Schema<number, number, "defined">;
    tokenPath: Schema<string, string, "defined">;
    mode: Schema<"readonly" | "readwrite" | "full", "readonly" | "readwrite" | "full", "defined">;
    maxChars: Schema<number, number, "defined">;
    pageSize: Schema<number, number, "defined">;
    timeoutMs: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    clientId: Schema<string, string, "plain">;
    clientSecret: Schema<string, string, "plain">;
    port: Schema<number, number, "defined">;
    bridgePort: Schema<number, number, "defined">;
    tokenPath: Schema<string, string, "defined">;
    mode: Schema<"readonly" | "readwrite" | "full", "readonly" | "readwrite" | "full", "defined">;
    maxChars: Schema<number, number, "defined">;
    pageSize: Schema<number, number, "defined">;
    timeoutMs: Schema<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: PluginConfig): void;
