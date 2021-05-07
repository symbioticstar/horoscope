import { Module } from '@nestjs/common'
import { ExecuteService } from './execute.service'
import { AdapterModule } from '../adapter/adapter.module'

@Module({
    providers: [ExecuteService],
    imports: [AdapterModule],
})
export class ExecuteModule {
}
