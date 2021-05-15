import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Adapter } from '../adapter'
import { HoroscopeAgentCallable, HoroscopeAgentCallTemplate, LocalMinimum } from '../types/local.minimum'
import { AgentResult, AgentResultOptional, AgentResultSet, Comparison } from '../types/agent-result'
import { RedisService } from '../../redis/redis.service'
import IORedis, { Redis } from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { IsNumberString, IsOptional, IsString, validateOrReject } from 'class-validator'
import { LanguageDef, languages } from './consts'
import * as path from 'path'
import { CommonAdapter } from '../common-adapter'
import { createPool, Pool } from 'generic-pool'

@Injectable()
export class LegacyRedisAdapter implements Adapter, OnModuleInit {

    name = 'legacy'
    private readonly queue: string
    private readonly tmpQueue: string
    private readonly pool: Pool<IORedis.Redis>
    private readonly logger = new Logger(LegacyRedisAdapter.name)

    constructor(
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
        private readonly commonAdapter: CommonAdapter,
    ) {

        this.pool = createPool<Redis>(
            {
                create: async () => {
                    return new IORedis({
                        host: this.configService.get('REDIS_HOST'),
                        port: this.configService.get('REDIS_PORT'),
                        password: this.configService.get('REDIS_PASSWORD'),
                        db: this.configService.get('REDIS_DB_LEVERAGE'),
                    })
                },
                destroy: async (client: Redis) => {
                    await client.quit()
                },
            },
            { max: 16, min: 4 },
        )

        this.queue = this.configService.get<string>('LEV_QUEUE', 'tx')
        this.tmpQueue = this.configService.get<string>('LEV_TMP_QUEUE', 'txt')
        this.commonAdapter.regist(this)
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


    async getTaskById(taskId: number | string) {
        const label = `task:${taskId}`
        const submission: RawTask = Object.assign(
            new RawTask(),
            await this.do(c => c.hgetall(label)),
        )
        await validateOrReject(submission)
        return submission
    }


    async getOne() {
        const taskId = await this.do(c => c.brpoplpush(this.queue, this.tmpQueue, 0))
        const label = `task:${taskId}`
        const taskStatusChangeLabel = `task-status-change:${taskId}`
        const submission = await this.getTaskById(taskId)

        const cases = parseInt(submission.cases, 10)
        const timeLimit = parseInt(submission.timeLimit, 10)
        const memoryLimit = Math.max(1024, parseInt(submission.memoryLimit, 10)) // minminal 1GiB

        const minimum = new LocalMinimum()
        minimum.id = taskId
        minimum.sourceCode = submission.code

        if (submission.spj || submission.spjId) throw new Error('Spj not supported')

        const pipeline: HoroscopeAgentCallable[] = []

        minimum.pipeline = pipeline
        minimum.from = this.name


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
        } else {
            pipeline.push({ empty: true, skip_if_fail: false, break_if_fail: false })
            pipeline.push({ empty: true, skip_if_fail: false, break_if_fail: false })
        }

        let template = new HoroscopeAgentCallTemplate(lang.runEnv, lang.runArgs)
        let comparer = new HoroscopeAgentCallTemplate('ojcmp', '/usr/local/cargo/bin/ojcmp2 -s @standard -u @user')
        comparer.trusted = true
        for (let i = 1; i <= cases; i++) {
            const input = path.join(submission.prefix, submission.logicId, `${i}.in`)
            const output = path.join(submission.prefix, submission.logicId, `${i}.out`)


            const run = template.make_call(['res', input], ['run', `${i}.ans`], '/dev/null')
            run.lifetime = timeLimit + 1
            run.max_mem = memoryLimit
            pipeline.push(run)

            let cmp = comparer.make_call('/dev/null', '/dev/null', '/dev/null', false, pipeline.length - 1)
            cmp.replacements = {
                '@standard': ['res', output],
                '@user': ['run', `${i}.ans`],
            }
            pipeline.push(cmp)
        }

        return minimum
    }


    // FIXME maybe redundant
    async reload() {
        // while (await this.do(c => c.rpoplpush(this.tmpQueue, this.queue))) {
        //
        // }
    }


    handleSingleRun(run: AgentResultOptional, cmp: AgentResultOptional, timeLimit: number, memoryLimit: number): SandboxResult {
        if (!run) {
            throw new Error('Bad Input: Missing [run]')
        }
        const r = SandboxResult.fromAgentResult(run)
        r.result = Status.AC
        if (run.hsc_err) {
            r.mainExitCode = run.hsc_err
            r.result = Status.SE
            return r
        }
        if (!run.ok) {
            if (timeLimit < (run.cpu_user + run.cpu_sys)) {
                // TLE
                r.result = Status.TLE
                return r
            }

            if (memoryLimit < run.memory) {
                // MLE
                r.result = Status.MLE
                return r
            }

            r.result = Status.RE
            return r
        } else {
            if (!cmp) {
                throw new Error('Bad Input: Missing [cmp]')
            }
            switch (cmp.status as Comparison) {
                case Comparison.AC:
                    break
                case Comparison.WA:
                    r.result = Status.WA
                    break
                case Comparison.PE:
                    r.result = Status.PE
                    break
                default:
                    // Internal Error
                    r.result = Status.SE
                    break
            }
            return r
        }
    }

    callback(resultSet: AgentResultSet): Promise<void> | void {
        const label = `task:${resultSet.minimum.id}`
        const taskStatusChangeLabel = `task-status-change:${resultSet.minimum.id}`
        const changeStatus = (
            status: number | string | Status,
            final: number | string,
        ) => {
            return Promise.all([
                this.do(c => c.hset(label, 'status', status)),
                this.do(c => c.rpush(taskStatusChangeLabel, final)),
            ])
        }

        const promise = new Promise(async (resolve, reject) => {
                try {
                    const res = resultSet.results

                    const submission = await this.getTaskById(resultSet.minimum.id)
                    const judgeResult: SandboxResult[] = []
                    const timeLimit = parseInt(submission.timeLimit, 10) * 1e9
                    const memoryLimit = parseInt(submission.memoryLimit, 10) * (1 << 20)


                    if (res.length === 0) {
                        // SE
                        submission.status = Status.SE.toString()
                        resolve(submission)
                        return
                    }


                    if (res[0] && !res[0]!.ok) {
                        // CE
                        submission.status = Status.CE.toString()
                        resolve(submission)
                        return
                    } else {
                        // No need to compile
                    }

                    // er.result or submission.status

                    submission.time = submission.memory = 0
                    submission.status = Status.AC.toString()


                    for (let i = 2; i < res.length; i += 2) {
                        const run = res[i]
                        const cmp = res[i + 1]
                        const r = this.handleSingleRun(run, cmp, timeLimit, memoryLimit)
                        if (r.result !== Status.AC) {
                            submission.status = r.result.toString()
                        }
                        submission.time += r.cpuTime
                        submission.memory += r.memory
                        judgeResult.push(r)
                    }

                    submission.judgeResult = JSON.stringify(judgeResult)
                    resolve(submission)
                } catch (e) {
                    reject(e)
                }
            },
        )

        return promise.then(async (submission: RawTask) => {
            await this.do(c => c.hmset(label, {
                'judgeResult': submission.judgeResult || '',
                'compileErrorMsg': submission.compileErrorMsg || '',
                'status': submission.status,
                'time': submission.time,
                'memory': submission.memory,
                'judger': 'Horoscope Alpha',
            }))
            await changeStatus(submission.status, 1)
            await this.do(c => c.expire(taskStatusChangeLabel, 5))
            this.logger.log(
                `${label} ${
                    StatusString[submission.status]
                } | M: ${submission.memory / 1000}MB T: ${
                    submission.time
                }ms`,
            )
        }).catch((errMsg) => {
            this.logger.error(errMsg)
        }).finally(async () => {
            await this.do(c => c.rpush(`rx`, resultSet.minimum.id))
        })
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
    exitCode: number
    status: number
    signal: number
    cpuTime: number
    userTime: number
    sysTime: number
    realTime: number
    memory: number
    judgeResult: number
    mainExitCode: number
    result: number

    static fromAgentResult(m: AgentResult) {
        const r = new SandboxResult()
        r.cpuTime = Math.round((m.cpu_sys + m.cpu_user) / 1e6)
        // r.sysTime = Math.round((m.cpu_sys) / 1e6)
        // r.userTime = Math.round((m.cpu_user) / 1e6)
        // r.realTime = ?
        r.exitCode = m.status
        r.signal = m.signal
        r.status = m.status
        r.memory = Math.round(m.memory / (1 << 10))
        return r
    }
}


export const StatusString = [
    'Accepted',
    'Wrong Answer',
    'Time Limit Exceeded',
    'Memory Limit Exceeded',
    'Compile Error',
    'System Error',
    'Runtime Error',
    'Presentation Error',
    'Compile Resource Limit Exceeded',
    'Pending',
    'Judging',
    'Compiling',
    'Output Limit Exceeded',
]