/**
 * 配置页本地桥：常驻 127.0.0.1 HTTP 服务，向插件的浏览器配置页暴露授权状态与一键授权。
 * 不暴露任何 token；start-auth 仅接受 POST。随插件卸载关闭。
 * @module dsh-tool-gdrive/bridge
 */
import http from 'node:http';
import { tryOpenBrowser } from './util.js';
const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
};
/**
 * 启动配置页桥。端口从 preferred 起递增重试 3 次；全部失败抛错（调用方降级为 warn）。
 * @param auth - 授权状态来源与授权流程入口。
 * @param preferred - 首选端口。
 */
export function startBridge(auth, preferred) {
    let attempt = 0;
    const tryPort = (port) => new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            void (async () => {
                try {
                    if (req.method === 'OPTIONS') {
                        res.writeHead(204, JSON_HEADERS);
                        res.end();
                        return;
                    }
                    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
                    if (url.pathname === '/gdrive/status' && req.method === 'GET') {
                        res.writeHead(200, JSON_HEADERS);
                        res.end(JSON.stringify(await auth.status()));
                        return;
                    }
                    if (url.pathname === '/gdrive/start-auth' && req.method === 'POST') {
                        const r = await auth.startAuth();
                        const openedBrowser = await tryOpenBrowser(r.authUrl);
                        res.writeHead(200, JSON_HEADERS);
                        res.end(JSON.stringify({ ...r, openedBrowser }));
                        return;
                    }
                    res.writeHead(404, JSON_HEADERS);
                    res.end('{"error":"not found"}');
                }
                catch (err) {
                    res.writeHead(500, JSON_HEADERS);
                    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
                }
            })();
        });
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE' && attempt < 2) {
                attempt++;
                resolve(tryPort(port + 1));
            }
            else {
                reject(err);
            }
        });
        server.listen(port, '127.0.0.1', () => {
            server.removeAllListeners('error');
            server.on('error', (e) => console.warn('[gdrive] 配置页桥运行期错误：', e));
            resolve({ port, close: () => server.close() });
        });
    });
    return tryPort(preferred);
}
//# sourceMappingURL=bridge.js.map