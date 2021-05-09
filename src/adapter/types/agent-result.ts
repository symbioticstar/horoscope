import { LocalMinimum } from './local.minimum'

export class AgentResult {
    hsc_err: number = 0
    status: number = 0
    signal: number = 0
    cpu_sys: number = 0
    cpu_user: number = 0
    memory: number = 0

    get ok() {
        return this.hsc_err === 0 && this.status === 0 && this.signal === 0
    }

    static fromStr(str: string) {
        const r = str.trim().split(' ').map(e => parseInt(e))
        if (r.length != 5) throw new Error('bad input')
        const ret = new AgentResult()
        ret.status = r[0]!
        ret.signal = r[1]!
        ret.cpu_sys = r[2]!
        ret.cpu_user = r[3]!
        ret.memory = r[4]!
        return ret
    }

    static fromErr(str: string) {
        const ret = new AgentResult()
        ret.hsc_err = parseInt(str, 10)
        return ret
    }
}

export type AgentResultOptional = AgentResult | undefined

export class AgentResultSet {
    constructor(
        public minimum: LocalMinimum,
        public results: AgentResult[],
    ) {
    }
}

