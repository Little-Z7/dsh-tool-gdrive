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
/** 逻辑配置（volatile 字段在运行期可能是装箱引用，统一经 readV 读取）。 */
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
    /** 只给浏览器半侧「检查更新」读；服务端不用。留空 = 缺省市场地址。 */
    marketUrl?: string;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    clientId: Schema<string, string, "volatile">;
    clientSecret: Schema<string, string, "volatile">;
    port: Schema<number, number, "volatile-defined">;
    bridgePort: Schema<number, number, "volatile-defined">;
    tokenPath: Schema<string, string, "volatile-defined">;
    mode: Schema<"readonly" | "readwrite" | "full", "readonly" | "readwrite" | "full", "volatile-defined">;
    maxChars: Schema<number, number, "volatile-defined">;
    pageSize: Schema<number, number, "volatile-defined">;
    timeoutMs: Schema<number, number, "volatile-defined">;
    marketUrl: Schema<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    clientId: Schema<string, string, "volatile">;
    clientSecret: Schema<string, string, "volatile">;
    port: Schema<number, number, "volatile-defined">;
    bridgePort: Schema<number, number, "volatile-defined">;
    tokenPath: Schema<string, string, "volatile-defined">;
    mode: Schema<"readonly" | "readwrite" | "full", "readonly" | "readwrite" | "full", "volatile-defined">;
    maxChars: Schema<number, number, "volatile-defined">;
    pageSize: Schema<number, number, "volatile-defined">;
    timeoutMs: Schema<number, number, "volatile-defined">;
    marketUrl: Schema<string, string, "volatile-defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: PluginConfig): void;
