import { AgentResultSet } from './types/agent-result'

export interface Adapter<> {
    name: string

    start()

    callback(res: AgentResultSet): Promise<void> | void
}