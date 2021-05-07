import { Injectable, OnModuleInit } from '@nestjs/common'

@Injectable()
export class AppService implements OnModuleInit {
    async onModuleInit() {
        // ensure all docker started
    }
}
