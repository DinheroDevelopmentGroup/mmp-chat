import { type ServerSystemMessage, type ServerPlayerMessage, type GlobalMessage, type LocalMessage, type ServerMessage } from './shared.js'
import { PACKET_PREDICTION } from './settings.js'
import { createChannel } from '../../worker/parent.js'
import proxy from '../proxy/local.js'
import { PublicEventHandler } from '../../util/events.js'
import { type Packet } from '../../util/packet.js'
import { type AsyncVoid } from '../../util/types.js'
import chalk from 'chalk'

type i64 = [number, number]

interface ClientChatMessage {
  message: string
  timestamp: i64
  salt: i64
  signature: Uint8Array | undefined
  offset: number
  acknowledged: Uint8Array
}

interface ClientChatCommand {
  command: string
  timestamp: i64
  salt: i64
  argumentSignatures: Uint8Array[]
  messageCount: number
  acknowledged: Uint8Array
}

interface ClientEventMap {
  message: (packet: Packet<ClientChatMessage>) => AsyncVoid
  command: (packet: Packet<ClientChatCommand>) => AsyncVoid
}

// TODO: Make server messages cancelable
interface ServerEventMap {
  player: (message: ServerPlayerMessage, possiblePacket?: Packet<ServerPlayerMessage>) => AsyncVoid
  system: (message: ServerSystemMessage, possiblePacket?: Packet<ServerSystemMessage>) => AsyncVoid
}

// ? Should I export the channel
export const channel = createChannel<LocalMessage, GlobalMessage>('chat')

export const chat = {
  client: new PublicEventHandler<ClientEventMap>(),
  server: new PublicEventHandler<ServerEventMap>(),

  toClient (message: unknown) {
    proxy.writeClient('system_chat', {
      content: JSON.stringify(message),
      isActionBar: false
    })
  },
  toServer (message: string) {
    channel.write(message)
  }
} as const

proxy.client.on('chat_message', async packet => {
  await chat.client.emit('message', packet as Packet<ClientChatMessage>)
})

proxy.client.on('chat_command', async packet => {
  await chat.client.emit('command', packet as Packet<ClientChatCommand>)
})

interface PredictedPacket<T extends ServerMessage = ServerMessage> {
  packet: Packet<T>
  callback: () => void
}

let predictedPacket: PredictedPacket | undefined

if (PACKET_PREDICTION.enabled) {
  for (const chat of ['player', 'system'] as const) {
    const event = `${chat}_chat` as const

    proxy.server.on(event, async packet => {
      if (predictedPacket !== undefined) {
        predictedPacket.callback()
      }

      await new Promise<void>(resolve => {
        predictedPacket = {
          callback: resolve,
          packet: packet as Packet<ServerMessage>
        }
      })
    })
  }
}

channel.subscribe(message => {
  const type = message.type

  void (async () => {
    let packet = predictedPacket?.packet
    const callback = predictedPacket?.callback

    if (packet !== undefined && packet.name !== `${type}_chat`) {
      const message = `Expected ${type}_chat packet, got ${JSON.stringify(packet.name)} packet`

      switch (PACKET_PREDICTION.onIncorrectPacket.log) {
        case 'none':
          break
        case 'warn':
          console.warn(chalk.yellow(message))
          break
        case 'error':
          throw new Error(message)
      }

      if (!PACKET_PREDICTION.onIncorrectPacket.emit) {
        console.info('Since packet was incorrect, won\'t be emitted')

        packet = undefined
      }
    }

    switch (type) {
      case 'player':
        await chat.server.emit('player', message.message, packet as Packet<ServerPlayerMessage> | undefined)
        break
      case 'system':
        await chat.server.emit('system', message.message, packet as Packet<ServerSystemMessage> | undefined)
        break
      default:
        throw new Error(`Invalid type: ${type as any}`)
    }

    if (callback !== undefined) {
      callback()
    }
  })()
})

export default chat
