import { EventEmitter } from 'node:events'
import NlsClient from './nls'

interface SpeechTranscriptionConfig {
  appkey: string
  token: string
  url: string
}

interface StartParams {
  format: string
  sample_rate: number
  enable_intermediate_result: boolean
  enable_punctuation_prediction: boolean
  enable_inverse_text_normalization: boolean
}

export class SpeechTranscription {
  private _event: EventEmitter
  private _config: SpeechTranscriptionConfig
  private _client: NlsClient | null = null
  private _taskid = ''

  constructor(config: SpeechTranscriptionConfig) {
    this._event = new EventEmitter()
    this._config = config
  }

  defaultStartParams(): StartParams {
    return {
      format: 'pcm',
      sample_rate: 16000,
      enable_intermediate_result: true,
      enable_punctuation_prediction: true,
      enable_inverse_text_normalization: true
    }
  }

  on(which: string, handler: (...args: any[]) => void): void {
    this._event.on(which, handler)
  }

  async start(param: StartParams, enablePing: boolean, pingInterval?: number): Promise<string> {
    this._client = new NlsClient(this._config)
    this._taskid = this._client.uuid()
    const req = {
      header: {
        message_id: this._client.uuid(),
        task_id: this._taskid,
        namespace: 'SpeechTranscriber',
        name: 'StartTranscription',
        appkey: this._config.appkey
      },
      payload: param,
      context: this._client.defaultContext()
    }

    return new Promise<string>(async (resolve, reject) => {
      try {
        await this._client!.start(
          // onmessage
          (msg: string | Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
            if (!isBinary) {
              const str = msg.toString()
              const msgObj = JSON.parse(str)
              if (msgObj.header.name === 'TranscriptionStarted') {
                this._event.emit('started', str)
                resolve(str)
              } else if (msgObj.header.name === 'TranscriptionResultChanged') {
                this._event.emit('changed', str)
              } else if (msgObj.header.name === 'TranscriptionCompleted') {
                this._event.emit('TranscriptionCompleted', str)
              } else if (msgObj.header.name === 'SentenceBegin') {
                this._event.emit('begin', str)
              } else if (msgObj.header.name === 'SentenceEnd') {
                this._event.emit('end', str)
              } else if (msgObj.header.name === 'TaskFailed') {
                if (this._client) {
                  this._client.clearPing()
                  this._client.shutdown()
                }
                this._client = null
                this._event.emit('TaskFailed', str)
                this._event.emit('failed', str)
              }
            }
          },
          // onclose
          () => {
            this._event.emit('closed')
          }
        )
        if (enablePing) {
          if (!pingInterval) {
            pingInterval = 6000
          }
          this._client!.setPing(pingInterval, () => {})
        }
        this._client!.send(JSON.stringify(req), false)
      } catch (error) {
        reject(error)
      }
    })
  }

  async close(param?: any): Promise<string> {
    if (this._client == null) {
      return new Promise((resolve, reject) => {
        process.nextTick(() => {
          reject('client is null')
        })
      })
    }

    const req = {
      header: {
        message_id: this._client.uuid(),
        task_id: this._taskid,
        namespace: 'SpeechTranscriber',
        name: 'StopTranscription',
        appkey: this._config.appkey
      },
      payload: param,
      context: this._client.defaultContext()
    }

    return new Promise<string>((resolve, reject) => {
      this._event.on('TranscriptionCompleted', (msg: string) => {
        if (this._client) {
          this._client.clearPing()
          this._client.shutdown()
          this._client = null
        }
        this._event.emit('completed', msg)
        resolve(msg)
      })

      this._event.on('TaskFailed', (msg: string) => {
        reject(msg)
      })

      this._client!.send(JSON.stringify(req), false)
    })
  }

  ctrl(param?: any): void {
    if (this._client == null) {
      throw new Error('client is null')
    }
    const req = {
      header: {
        message_id: this._client.uuid(),
        task_id: this._taskid,
        namespace: 'SpeechTranscriber',
        name: 'ControlTranscription',
        appkey: this._config.appkey
      },
      payload: param,
      context: this._client.defaultContext()
    }
    this._client.send(JSON.stringify(req), false)
  }

  shutdown(): void {
    if (this._client == null) {
      return
    }

    this._client.shutdown()
  }

  sendAudio(data: string | ArrayBuffer | Buffer): boolean {
    if (this._client == null) {
      return false
    }

    this._client.send(data, true)
    return true
  }
}
