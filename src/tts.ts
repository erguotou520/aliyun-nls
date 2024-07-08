import NlsClient from "./nls";
import { EventEmitter } from "events";

interface SpeechSynthesizerConfig {
  appkey: string;
  token: string;
  url: string;
}

interface StartParams {
  voice: string;
  format: string;
  sample_rate: number;
  volume: number;
  speech_rate: number;
  pitch_rate: number;
  enable_subtitle: boolean;
}

export class SpeechSynthesizer {
  private _event: EventEmitter;
  private _config: SpeechSynthesizerConfig;
  private _namespace: string;
  private _client: NlsClient | null = null;
  private _taskid: string = "";

  constructor(config: SpeechSynthesizerConfig, enable_real_time: boolean = false) {
    this._event = new EventEmitter();
    this._config = config;
    this._namespace = enable_real_time ? "SpeechLongSynthesizer" : "SpeechSynthesizer";
  }

  defaultStartParams(voice: string): StartParams {
    return {
      voice: voice,
      format: "wav",
      sample_rate: 16000,
      volume: 50,
      speech_rate: 0,
      pitch_rate: 0,
      enable_subtitle: false
    };
  }

  on(which: string, handler: (...args: any[]) => void): void {
    this._event.on(which, handler);
  }

  async start(param: StartParams, enablePing: boolean, pingInterval?: number): Promise<string> {
    this._client = new NlsClient(this._config);
    this._taskid = this._client.uuid();
    const req = {
      header: {
        message_id: this._client.uuid(),
        task_id: this._taskid,
        namespace: this._namespace,
        name: "StartSynthesis",
        appkey: this._config.appkey
      },
      payload: param,
      context: this._client.defaultContext()
    };

    return new Promise<string>(async (resolve, reject) => {
      try {
        await this._client!.start(
          // onmessage
          (msg: string | Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
            if (!isBinary) {
              const str = msg.toString();
              const msgObj = JSON.parse(str);
              if (msgObj.header.name === "MetaInfo") {
                this._event.emit("meta", str);
              } else if (msgObj.header.name === "SynthesisCompleted") {
                if (this._client) {
                  this._client.clearPing();
                  this._client.shutdown();
                }
                this._client = null;
                this._event.emit("completed", str);
                resolve(str);
              } else if (msgObj.header.name === "TaskFailed") {
                if (this._client) {
                  this._client.clearPing();
                  this._client.shutdown();
                }
                this._client = null;
                this._event.emit("TaskFailed", str);
                this._event.emit("failed", str);
                reject(str);
              }
            } else {
              this._event.emit("data", msg);
            }
          },
          // onclose
          () => {
            this._event.emit("closed");
          }
        );
        if (enablePing) {
          if (!pingInterval) {
            pingInterval = 6000;
          }
          this._client!.setPing(pingInterval, () => {});
        }
        this._client!.send(JSON.stringify(req), false);
      } catch (error) {
        reject(error);
      }
    });
  }

  shutdown(): void {
    if (this._client == null) {
      return;
    }

    this._client.shutdown();
  }
}