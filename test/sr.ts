// import { sleep } from 'bun'
import { SpeechRecognition } from '../src/sr'
import fs from 'fs'

const URL = 'wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1'
const APPKEY = process.env.APPKEY //获取Appkey请前往控制台：https://nls-portal.console.aliyun.com/applist
const TOKEN = process.env.TOKEN //获取Token具体操作，请参见：https://help.aliyun.com/document_detail/450514.html

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const audioStream = fs.createReadStream('nls-sample-16k.wav', {
  encoding: 'binary',
  highWaterMark: 10
})
const b1: Buffer[] = []

audioStream.on('data', (chunk: string) => {
  const b = Buffer.from(chunk, 'binary')
  b1.push(b)
})

audioStream.on('close', async () => {
  const sr = new SpeechRecognition({
    url: URL,
    appkey: APPKEY,
    token: TOKEN
  })

  sr.on('started', msg => {
    console.log('Client recv started:', msg)
  })

  sr.on('changed', msg => {
    console.log('Client recv changed:', msg)
  })

  sr.on('completed', msg => {
    console.log('Client recv completed:', msg)
  })

  sr.on('closed', (reason) => {
    console.log('Client recv closed: + ', reason)
  })

  sr.on('failed', msg => {
    console.log('Client recv failed:', msg)
  })

  try {
    await sr.start(sr.defaultStartParams(), true, 6000)
  } catch (error) {
    console.log('error on start:', error)
  }

  try {
    for (const b of b1) {
      if (!sr.sendAudio(b)) {
        throw new Error('send audio failed')
      }
      await sleep(100)
    }
  } catch (error) {
    console.log('sendAudio failed:', error)
  }

  try {
    console.log('close...')
    await sr.close()
  } catch (error) {
    console.log('error on close:', error)
  }
  await sleep(2000)
})
