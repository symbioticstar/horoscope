import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Adapter } from '../adapter'
import { HoroscopeAgentCallable, HoroscopeAgentCallTemplate, LocalMinimum } from '../types/local.minimum'
import { AgentResult } from '../types/agent-result'
import { RedisService } from '../../redis/redis.service'
import IORedis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { IsNumber, IsNumberString, IsOptional, IsString, validateOrReject } from 'class-validator'
import { LanguageDef, languages } from './consts'
import * as path from 'path'
import { CommonAdapter } from '../common-adapter'

@Injectable()
export class LegacyRedisAdapter implements Adapter, OnModuleInit {

    private readonly queue: string
    private readonly tmpQueue: string
    private readonly redis: IORedis.Redis
    private readonly logger = new Logger(LegacyRedisAdapter.name)


    constructor(
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
        private readonly commonAdapter: CommonAdapter,
    ) {
        this.redis = new IORedis({
            host: this.configService.get('REDIS_HOST'),
            port: this.configService.get('REDIS_PORT'),
            password: this.configService.get('REDIS_PASSWORD'),
            db: this.configService.get('REDIS_DB_LEVERAGE'),
        })
        this.queue = this.configService.get<string>('LEV_QUEUE', 'tx')
        this.tmpQueue = this.configService.get<string>('LEV_TMP_QUEUE', 'txt')
        this.commonAdapter.regist('legacy', this)
    }

    async onModuleInit() {
        const _ = this.start()
    }


    async start() {
        this.logger.log('Reloading')
        await this.reload()
        this.logger.log('Reloaded')

        while (true) {
            try {
                const ret = await this.getOne()
                await this.commonAdapter.addNew(ret)
            } catch (e) {
                this.logger.error(e)
            }
        }
    }

    async getOne() {
        const taskId = await this.redis.brpoplpush(this.queue, this.tmpQueue, 0)
        const label = `task:${taskId}`
        const taskStatusChangeLabel = `task-status-change:${taskId}`
        const submission: RawTask = Object.assign(
            new RawTask(),
            await this.redis.hgetall(label),
        )
        await validateOrReject(submission)

        const cases = parseInt(submission.cases, 10)
        const timeLimit = parseInt(submission.timeLimit, 10)
        const memoryLimit = Math.max(1 << 30, parseInt(submission.memoryLimit, 10)) // minminal 1GiB

        const minimum = new LocalMinimum()
        minimum.id = taskId
        minimum.sourceCode = submission.code

        if (submission.spj || submission.spjId) throw new Error('Spj not supported')

        const pipeline: HoroscopeAgentCallable[] = []

        minimum.pipeline = pipeline


        const lang: LanguageDef = languages[submission.language]
        if (!lang) throw new Error('Language not supported')

        minimum.sourceName = `${lang.srcName}.${lang.suffix}`

        // Handle Compile
        if (lang.compileEnv && lang.compileArgs) {
            let template = new HoroscopeAgentCallTemplate(lang.compileEnv, lang.compileArgs)
            let comp = template.make_call('/dev/null', '/dev/null', ['src', 'compile.log'])
            comp.execve_once = false
            pipeline.push(comp)
            pipeline.push({ empty: true, skip_if_fail: false, break_if_fail: 0 })
        }

        let template = new HoroscopeAgentCallTemplate(lang.runEnv, lang.runArgs)
        let comparer = new HoroscopeAgentCallTemplate('ojcmp', '/usr/local/cargo/bin/ojcmp2 -s /proc/self/fd/3 -u /proc/self/fd/4')
        comparer.trusted = true
        for (let i = 1; i <= cases; i++) {
            const input = path.join(submission.prefix, submission.logicId, `${i}.in`)
            const output = path.join(submission.prefix, submission.logicId, `${i}.out`)


            const run = template.make_call(['res', input], ['src', `${i}.ans`], '/dev/null')
            run.lifetime = timeLimit + 1
            run.max_mem = memoryLimit
            pipeline.push(run)

            let cmp = comparer.make_call('/dev/null', '/dev/null', '/dev/null', false, pipeline.length - 1)
            cmp.fd3_path = ['res', output]
            cmp.fd4_path = ['src', `${i}.ans`]
            pipeline.push(cmp)
        }

        return minimum
    }


    // FIXME maybe redundant
    async reload() {
        // while (await this.redis.rpoplpush(this.tmpQueue, this.queue)) {
        //
        // }
    }


    callback(output: AgentResult[]): Promise<void> | void {
        return undefined
    }

}

export enum Status {
    AC,
    WA,
    TLE,
    MLE,
    CE,
    SE,
    RE,
    PE,
    CRLE,
    PENDING,
    JUDGING,
    COMPILING,
    OLE,
}

export class RawTask {
    @IsString()
    prefix: string

    @IsNumberString()
    logicId: string

    /** Source Code */
    @IsString()
    readonly code: string

    @IsNumberString()
    readonly language: string

    /** Resource Limitations */
    @IsNumberString()
    readonly memoryLimit: string
    @IsNumberString()
    readonly timeLimit: string

    @IsNumberString()
    readonly cases: string

    @IsNumberString()
    problemId: string

    /**
     * if set, means that the submission requires spj checker whose id equals to spjId
     */
    @IsOptional()
    @IsNumberString()
    spjId?: string


    /**
     * If set, means that this is an VIRTUAL submission which actually an spj checker.
     * Meanwhile, spjId should be set
     */
    spj?: string

    status: string

    compileErrorMsg: string

    judgeResult: string

    time: number = 0

    judger: string

    memory: number = 0

    set setJudgeResult(results: SandboxResult[]) {
        this.judgeResult = JSON.stringify(results)
    }
}

export class SandboxResult {
    @IsNumber()
    exitCode: number

    @IsNumber()
    status: number

    @IsNumber()
    signal: number

    @IsNumber()
    cpuTime: number

    @IsNumber()
    userTime: number

    @IsNumber()
    sysTime: number

    @IsNumber()
    realTime: number

    @IsNumber()
    memory: number

    @IsNumber()
    judgeResult: number
}
