import assert from 'assert'
import crypto from 'crypto'
import WebSocket from 'ws'

interface NlsConfig {
  url: string;
  appkey: string;
  token: string;
}

class NlsClient {
  private _config: NlsConfig;
  private _ws: WebSocket | null = null;
  private _ping: ReturnType<typeof setInterval> | null = null;

  constructor(config: NlsConfig) {
    assert(config, 'must pass "config"');
    assert(config.url, 'must pass "url"');
    assert(config.appkey, 'must pass "appkey"');
    assert(config.token, 'must first get token from cache or getToken interface');
    this._config = config;
  }

  start(onmessage: (data: string | Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => void, onclose: (reason: string) => void): Promise<void> {
    if (typeof onmessage !== 'function') {
      throw new Error("expect function onmessage");
    }
    if (typeof onclose !== 'function') {
      throw new Error("expect function onclose");
    }
    
    return new Promise((resolve, reject) => {
      // @ts-ignore
      this._ws = new WebSocket(this._config.url, {
        headers: { "X-NLS-Token": this._config.token },
        maxPayloadLength: 1024 * 1024 // 1MB
      });

      this._ws.binaryType = "arraybuffer";

      this._ws.onmessage = (event) => {
        onmessage(event.data, event.data instanceof ArrayBuffer);
      };

      this._ws.onclose = (args) => {
        onclose(args.reason);
      };

      this._ws.onopen = () => {
        resolve();
      };

      this._ws.onerror = (err) => {
        reject(err);
      };
    });
  }

  send(data: string | ArrayBuffer | Buffer, isBinary: boolean): void {
    if (this._ws == null) {
      return;
    }
    const maxBufferSize = 48000; // 48KB
    if (data instanceof Buffer || typeof data === "string") {
      let offset = 0;
      // bun websocket 有尺寸限制，最大 65535
      while (offset < data.length) {
        const chunkSize = Math.min(data.length - offset, maxBufferSize);
        const chunk = data.slice(offset, offset + chunkSize);
        this._ws.send(chunk);
        offset += chunkSize;
      }
    } else if (data instanceof ArrayBuffer) {
      let offset = 0;
      // bun websocket 有尺寸限制，最大 65535
      while (offset < data.byteLength) {
        const chunkSize = Math.min(data.byteLength - offset, maxBufferSize);
        const chunk = data.slice(offset, offset + chunkSize);
        this._ws.send(chunk);
        offset += chunkSize;
      }
    }
    // this._ws.send(data);
  }

  setPing(interval: number, callback: () => void): void {
    this._ping = setInterval(() => {
      if (this._ws) {
        this._ws.send("ping");
        callback();
      }
    }, interval);
  }

  clearPing(): void {
    if (this._ping) {
      clearInterval(this._ping);
    }
  }

  shutdown(): void {
    if (this._ws == null) {
      return;
    }
    if (this._ping != null) {
      clearInterval(this._ping);
    }
    this._ws.close();
  }

  uuid(): string {
    return crypto.randomUUID().split("-").join("");
  }

  defaultContext(): object {
    return {
      sdk: {
        name: "nls-nodejs-sdk",
        version: "0.0.1",
        language: "nodejs"
      }
    };
  }
}

export default NlsClient;