import { type ServerSystemMessage, type ServerPlayerMessage, type GlobalMessage, type LocalMessage } from './shared.js'
import { createChannel } from '../../worker/parent.js'
import proxy from '../proxy/local.js'
import { PublicEventHandler } from '../../util/events.js'
import { type Packet } from '../../util/packet.js'
import { type AsyncVoid } from '../../util/types.js'

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
  player: (message: ServerPlayerMessage) => AsyncVoid
  system: (message: ServerSystemMessage) => AsyncVoid
}

// ? Should I export the channel
export const channel = createChannel<LocalMessage, GlobalMessage>('chat')

export class Chat {
  public readonly client = new PublicEventHandler<ClientEventMap>()
  public readonly server = new PublicEventHandler<ServerEventMap>()

  constructor () {
    proxy.client.on('chat_message', async packet => {
      await this.client.emit('message', packet as Packet<ClientChatMessage>)
    })

    proxy.client.on('chat_command', async packet => {
      await this.client.emit('command', packet as Packet<ClientChatCommand>)
    })

    channel.subscribe(message => {
      const type = message.type

      switch (type) {
        case 'player':
          void this.server.emit('player', message.message)
          break
        case 'system':
          void this.server.emit('system', message.message)
          break
        default:
          throw new Error(`Invalid type: ${type as any}`)
      }
    })
  }

  public toServer (message: string): void {
    channel.write(message)
  }

  public toClient (message: unknown): void {
    proxy.writeClient('system_chat', {
      content: JSON.stringify(message),
      isActionBar: false
    })
  }
}

export const chat = new Chat()

export default chat
