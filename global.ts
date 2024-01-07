import type Instance from '../../instance/index.js'
import { type LocalMessage, type GlobalMessage } from './shared.js'

export default async function (instance: Instance): Promise<void> {
  const channel = instance.createChannel<GlobalMessage, LocalMessage>('chat')

  const server = instance.server

  server.on('playerChat', data => {
    channel.write({
      type: 'player',
      message: data
    })
  })

  server.on('systemChat', data => {
    channel.write({
      type: 'system',
      message: data
    })
  })

  channel.subscribe(message => {
    server.chat(message)
  })
}
