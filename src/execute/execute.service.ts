import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { HoroscopeAgentCall, HoroscopeAgentCallable, LocalMinimum } from '../adapter/types/local.minimum'
import { AgentResult, AgentResultSet } from '../adapter/types/agent-result'
import { ConfigService } from '@nestjs/config'
import { images } from '../images'
import got from 'got'
import * as path from 'path'
import { chmod, chown, ensureDir, mkdir, remove, writeFile } from 'fs-extra'
import { CommonAdapter } from '../adapter/common-adapter'
import { execSync } from 'child_process'

@Injectable()
export class ExecuteService implements OnModuleInit {

    private readonly srcDir: string
    private readonly resDir: string
    private readonly runDir: string
    private readonly workers: number
    private readonly logger = new Logger(ExecuteService.name)

    constructor(private readonly configService: ConfigService, private readonly commonAdapter: CommonAdapter) {
        this.srcDir = this.configService.get<string>('SRC_DIR')!
        this.resDir = this.configService.get<string>('RES_DIR')!
        this.runDir = this.configService.get<string>('RUN_DIR')!
        this.workers = this.configService.get<number>('WORKERS', 8)
    }

    async onModuleInit() {
        for (const e of [this.resDir, this.runDir]) {
            await ensureDir(e)
            execSync(`chmod -R 700 ${e}`)
            execSync(`chown -R root:root ${e}`)
        }
        execSync(`chmod -R 755 ${this.srcDir}`)


        await this.commonAdapter.reloadAll()
        for (let i = 0; i < this.workers; i++) {
            const _ = this.watch(i)
        }
    }

    async watch(id: number) {
        const logger = new Logger(`${ExecuteService.name} #${id}`)
        logger.log(`Worker #${id} started`)

        const uid = 10000 + id
        while (true) {
            try {
                const minimum = await this.commonAdapter.popNew()
                logger.log(`Accept ${minimum.id}`)
                const results = await this.handleMinimum(minimum, uid)
                logger.log(`Handled ${minimum.id}`)
                const resultSet = new AgentResultSet(minimum, results)
                await this.commonAdapter.pushResult(resultSet)
            } catch (e) {
                logger.error(e)
                console.error(e)
                // TODO logging and error handling
            }
        }
    }

    async handleMinimum(minimum: LocalMinimum, uid: number) {
        const id = minimum.id
        const srcPath = path.join(this.srcDir, id)
        const runPath = path.join(this.runDir, id)
        // parent dir must created before
        await remove(srcPath)
        await remove(runPath)
        await mkdir(srcPath)
        await mkdir(runPath)
        await chmod(srcPath, 0o700)
        await chmod(runPath, 0o700)

        const sourceName = path.join(srcPath, minimum.sourceName)
        await writeFile(sourceName, minimum.sourceCode, { mode: 0o700 })

        await chown(srcPath, uid, uid)
        await chown(sourceName, uid, uid)

        const results: AgentResult[] = []
        for (const [i, e] of minimum.pipeline.entries()) {
            if (e.break_if_fail !== false) {
                const result = results[e.break_if_fail]
                if (!result) {
                    throw new Error('empty result')
                }
                if (!result.ok) {
                    break
                }
            }
            await this.callAgent(i, srcPath, runPath, uid, e, results)
        }
        // await remove(srcPath)
        // await remove(runPath)
        return results
    }


    async callAgent(index: number, srcPath: string, runPath: string, uid: number, callable: HoroscopeAgentCallable, results: AgentResult[]) {

        if (callable.skip_if_fail !== false) {
            const result = results[callable.skip_if_fail]
            if (!result) {
                // console.log(callable)
                // console.log(results)
                throw new Error('empty result')
            }
            if (!result.ok) {
                return
            }
        }
        if (callable.empty) return

        let u = callable.trusted ? 0 : uid
        const url = HoroscopeAgentCall.prototype.make_url.call(callable, images, u, u, srcPath, this.resDir, runPath)
        console.log(url)

        const ret = await got(url, { throwHttpErrors: false })

        console.log({ code: ret.statusCode, body: ret.body })

        if (ret.statusCode === 200) {
            const agentRet = ret.body
            results[index] = AgentResult.fromStr(agentRet)
        } else if (ret.statusCode === 400) {
            // system error
            const agentErr = ret.body
            // TODO log
            results[index] = AgentResult.fromErr('400')
        } else if (ret.statusCode === 500) {
            // system error
            const agentRet = ret.body
            results[index] = AgentResult.fromErr(agentRet)

        } else {
            results[index] = AgentResult.fromErr('500')
        }

    }
}
