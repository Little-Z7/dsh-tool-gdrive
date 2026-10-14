import type { GDriveAuth } from './auth.js';
export interface BridgeHandle {
    port: number;
    close: () => void;
}
/**
 * 启动配置页桥。端口从 preferred 起递增重试 3 次；全部失败抛错（调用方降级为 warn）。
 * @param auth - 授权状态来源与授权流程入口。
 * @param preferred - 首选端口。
 */
export declare function startBridge(auth: GDriveAuth, preferred: number): Promise<BridgeHandle>;
