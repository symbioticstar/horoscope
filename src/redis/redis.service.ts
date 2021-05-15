import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import IORedis, { Redis } from 'ioredis'
import { createPool, Pool } from 'generic-pool'

@Injectable()
export class RedisService {
    pool: Pool<Redis>

    constructor(private readonly configService: ConfigService) {
        this.pool = createPool<Redis>(
            {
                create: async () => {
                    return new IORedis({
                        host: this.configService.get('REDIS_HOST'),
                        port: this.configService.get('REDIS_PORT'),
                        password: this.configService.get('REDIS_PASSWORD'),
                    })
                },
                destroy: async (client: Redis) => {
                    await client.quit()
                },
            },
            { max: 16, min: 4},
        )
    }

    async do<T>(fn: (client: Redis) => Promise<T>): Promise<T> {
        const client = await this.pool.acquire()
        try {
            return await fn(client)
        } catch (e) {
            throw e
        } finally {
            await this.pool.release(client)
        }
    }

}
