import * as querystring from 'querystring'
import * as path from 'path'
import { ImageRecord } from '../../images'

export class LocalMinimum {
    id: string
    from: string
    sourceCode: string
    sourceName: string
    pipeline: HoroscopeAgentCallable[]
}

export type HoroscopeAgentCallable = {
    empty: false
    skip_if_fail: number | false
    break_if_fail: number | false
    trusted: boolean

    make_url(containers: ImageRecord, uid: number, gid: number, src: string, res: string, run: string): string
} | {
    empty: true
    skip_if_fail: number | false
    break_if_fail: number | false
}

export class HoroscopeAgentCallTemplate {
    container_name: string

    lifetime?: number
    max_mem?: number
    max_pid?: number
    rlimit_stack?: number
    rlimit_fsize?: number

    execve_once: boolean = true

    cwd?: string
    args_str: string

    trusted: boolean = false

    constructor(container_name: string, args_str: string) {
        this.container_name = container_name
        this.args_str = args_str
    }

    make_call(
        stdin_path: PathClaim = '/dev/null',
        stdout_path: PathClaim = '/dev/null',
        stderr_path: PathClaim = '/dev/null',
        break_if_fail: number | false = false,
        skip_if_fail: number | false = false,
    ) {
        let s = new HoroscopeAgentCall(this.container_name, this.args_str)
        Object.assign(s, this)
        s.stdin_path = stdin_path
        s.stdout_path = stdout_path
        s.stderr_path = stderr_path
        s.break_if_fail = break_if_fail
        s.skip_if_fail = skip_if_fail
        s.empty = false
        return s
    }
}

export type PathClaim = ['src', string] | ['res', string] | ['run', string] | string

export class HoroscopeAgentCall extends HoroscopeAgentCallTemplate {
    stdin_path: PathClaim
    stdout_path: PathClaim
    stderr_path: PathClaim

    replacements: Record<string, PathClaim>

    break_if_fail: number | false
    skip_if_fail: number | false
    empty: boolean


    make_url(containers: ImageRecord, uid: number, gid: number, src: string, res: string, run: string): string {
        const { container_name, break_if_fail, skip_if_fail, empty, trusted, replacements, ...etc } = this


        const parse = (key) => {
            if (etc[key] && typeof etc[key] !== 'string') {
                let prefix = ({ src, res, run })[etc[key][0]]
                etc[key] = path.join(prefix, etc[key][1])
            }
        }

        etc.cwd = src
        etc['uid'] = uid
        etc['gid'] = gid

        parse('stdin_path')
        parse('stdout_path')
        parse('stderr_path')

        if (replacements) {
            for (const k in replacements) {
                let val = replacements[k]!
                if (val && typeof val !== 'string') {
                    let prefix = ({ src, res, run })[val[0]]
                    val = path.join(prefix, val[1])
                }
                etc.args_str = etc.args_str.replace(k, val)
            }
        }


        const rec = containers[container_name]
        const port = rec && rec[1]
        if (!port) throw new Error('container not found')
        const qs = querystring.stringify(etc as any)
        return `http://127.0.0.1:${port}/run?${qs}`
    }

    private translate_path(key: string, src: string, res: string) {

    }
}
