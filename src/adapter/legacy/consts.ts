export class LanguageDef {
    compileEnv: string | null
    runEnv: string
    srcName: string
    suffix: string
    compileArgs: string | null
    runArgs: string

    constructor(compileEnv: string | null, runEnv: string, srcName: string, suffix: string, compileArgs: ((srcName, suffix) => string) | null, runArgs: (srcName, suffix) => string) {
        this.compileEnv = compileEnv
        this.runEnv = runEnv
        this.srcName = srcName
        this.suffix = suffix
        this.compileArgs = compileArgs && compileArgs(srcName, suffix)
        this.runArgs = runArgs(srcName, suffix)
    }

}


export enum Lang {
    c11,
    c89,
    c99,
    cpp11,
    cpp14,
    cpp17,
    java,
    /** @discontinued */
    python2,
    python3,
    /** @discontinued */
    javascript,
    /** @discontinued */
    typescript,
    rust,
    /** @discontinued */
    clangxx10_2a
}


export const languages: LanguageDef[] = []

languages[Lang.c11] = new LanguageDef('gcc', 'gcc', 'src', 'c',
    (n, s) => `gcc ${n}.${s} -o ${n} -O2 -lm -static -std=gnu11`,
    (n, s) => `./${n}`)
languages[Lang.c89] = new LanguageDef('gcc', 'gcc', 'src', 'c',
    (n, s) => `gcc ${n}.${s} -o ${n} -O2 -lm -static -std=gnu89`,
    (n, s) => `./${n}`)
languages[Lang.c99] = new LanguageDef('gcc', 'gcc', 'src', 'c',
    (n, s) => `gcc ${n}.${s} -o ${n} -O2 -lm -static -std=gnu11`,
    (n, s) => `./${n}`)

languages[Lang.cpp11] = new LanguageDef('gcc', 'gcc', 'src', 'cpp',
    (n, s) => `g++ ${n}.${s} -o ${n} -O2 -static -std=gnu++11`,
    (n, s) => `./${n}`)
languages[Lang.cpp14] = new LanguageDef('gcc', 'gcc', 'src', 'cpp',
    (n, s) => `g++ ${n}.${s} -o ${n} -O2 -static -std=gnu++14`,
    (n, s) => `./${n}`)
languages[Lang.cpp17] = new LanguageDef('gcc', 'gcc', 'src', 'cpp',
    (n, s) => `g++ ${n}.${s} -o ${n} -O2 -static -std=gnu++17`,
    (n, s) => `./${n}`)

languages[Lang.python3] = new LanguageDef(null, 'python', 'src', 'py',
    null,
    (n, s) => `python ${n}.${s}`)

languages[Lang.java] = new LanguageDef('java', 'java', 'Main', 'java',
    (n, s) => `javac -J-Xms512m -J-Xmx512m -encoding UTF-8 ${n}.${s}`,
    (n, s) => `java -XX:+UseSerialGC -Xss64m -Xms512m -Xmx512m ${n}`)