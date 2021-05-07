import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class DockerService {
    private src_path: string
    private res_path: string
    private agent_bin: string

    constructor(private readonly configService: ConfigService) {

    }

    run() {
    }
}
