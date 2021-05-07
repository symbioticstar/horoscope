import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { RedisModule } from './redis/redis.module'
import { CommonConfigModule } from './common-config/common-config.module'
import { ConfigModule } from '@nestjs/config'
import { DockerModule } from './docker/docker.module'
import { AdapterModule } from './adapter/adapter.module'
import { ExecuteModule } from './execute/execute.module'
import * as Joi from 'joi'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.dev', '.env'],
            validationSchema: Joi.object({
                REDIS_HOST: Joi.string(),
                REDIS_PORT: Joi.number().default(6379),
                REDIS_USERNAME: Joi.string(),
                REDIS_PASSWORD: Joi.string(),
                REDIS_DB_LEVERAGE: Joi.number().required(),
                QUEUE_TX: Joi.string().default('hs_tx'),
                QUEUE_TXT: Joi.string().default('hs_txt'),
                QUEUE_RX: Joi.string().default('hs_rx'),
                QUEUE_RXT: Joi.string().default('hs_rxt'),
            }),
        }),
        RedisModule,
        CommonConfigModule,
        DockerModule,
        AdapterModule,
        ExecuteModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
