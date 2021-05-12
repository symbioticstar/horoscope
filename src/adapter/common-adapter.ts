import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { LocalMinimum } from './types/local.minimum'
import { ConfigService } from '@nestjs/config'
import { AgentResultSet } from './types/agent-result'
import { Adapter } from './adapter'

@Injectable()
export class CommonAdapter {
    adapters: Map<string, Adapter> = new Map<string, Adapter>()
    private readonly tx: string
    private readonly txt: string
    private readonly rx: string
    private readonly logger = new Logger(CommonAdapter.name)

    constructor(private readonly redisService: RedisService, private readonly configService: ConfigService) {
        this.tx = configService.get<string>('QUEUE_TX')!
        this.txt = configService.get<string>('QUEUE_TXT')!
        this.rx = configService.get<string>('QUEUE_RX')!

    }

    regist(adapter: Adapter) {
        this.adapters.set(adapter.name, adapter)
    }

    getAdapter(name: string, throws = true) {
        const a = this.adapters.get(name)
        if (!a && throws) {
            throw new Error('Adapter not found:' + name)
        }
        return a
    }

    async addNew(minimum: LocalMinimum) {
        this.logger.log(`Add new: ${minimum.id}`)
        await this.redisService.do(c => c.set(`ht:${minimum.id}`, JSON.stringify(minimum)))
        await this.redisService.do(c => c.lpush(this.tx, minimum.id))
    }

    async popNew(): Promise<LocalMinimum> {
        const id = await this.redisService.do(c => c.brpoplpush(this.tx, this.txt, 0))
        const raw = await this.redisService.do(c => c.get(`ht:${id}`))
        if (!raw) throw new Error('Empty ht')
        return JSON.parse(raw)
    }

    async pushResult(result: AgentResultSet) {
        const adapter = this.adapters.get(result.minimum.from)
        if (!adapter) throw new Error(`Adapter not found for ${result.minimum.id}: ${result.minimum.from}`)
        await adapter.callback(result)
        await this.redisService.do(e => e.lrem(this.txt, 0, result.minimum.id))
        this.logger.log(`Pushed ${result.minimum.id}`)
        await this.logSpeed(result.results.reduce((p, c) => {
            if (c) p++
            return p
        }, 0))
    }

    async logSpeed(cnt) {
        const sec = (BigInt(Date.now()) / 60000n).toString()
        await this.redisService.do(e => e.incrby(`spd:${sec}`, cnt))
    }


    async reloadAll() {
        while (await this.redisService.do(c => c.rpoplpush(this.txt, this.tx))) {
        }
    }
}
