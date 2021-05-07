import { LocalMinimum } from './types/local.minimum'
import { AgentResult } from './types/agent-result'

export interface Adapter<> {
    start()

    callback(output: AgentResult[]): Promise<void> | void
}