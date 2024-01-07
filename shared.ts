export interface ServerPlayerMessage {
  formattedMessage: string
  message: string
  type: string
  sender: string
  senderName: string
  senderTeam: string
  verified?: boolean | undefined
}

export interface ServerSystemMessage {
  positionId: number
  formattedMessage: string
}

export type GlobalMessage = {
  type: 'player'
  message: ServerPlayerMessage
} | {
  type: 'system'
  message: ServerSystemMessage
}

export type LocalMessage = string
