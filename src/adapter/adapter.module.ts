import { Module } from '@nestjs/common'
import { LegacyRedisAdapter } from './legacy/legacy-redis-adapter'
import { CommonAdapter } from './common-adapter'

@Module({
    providers: [LegacyRedisAdapter, CommonAdapter],
    exports: [LegacyRedisAdapter, CommonAdapter],
})
export class AdapterModule {
}
