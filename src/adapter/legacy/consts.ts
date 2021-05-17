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
    clangxx10_2a,
    kotlin,
    ruby,
    node,
    perl,
    groovy,
    haskell,
    golang,
    cpp20,
    swift,
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
languages[Lang.cpp20] = new LanguageDef('gcc', 'gcc', 'src', 'cpp',
    (n, s) => `g++ ${n}.${s} -o ${n} -O2 -static -std=gnu++20`,
    (n, s) => `./${n}`)

languages[Lang.python3] = new LanguageDef(null, 'python', 'src', 'py',
    null,
    (n, s) => `/usr/local/bin/python ${n}.${s}`)

languages[Lang.java] = new LanguageDef('java', 'java', 'Main', 'java',
    (n, s) => `javac -J-Xms512m -J-Xmx512m -encoding UTF-8 ${n}.${s}`,
    (n, s) => `/usr/local/openjdk-11/bin/java -XX:+UseSerialGC -Xss64m -Xms512m -Xmx512m ${n}`)

languages[Lang.golang] = new LanguageDef('golang', 'golang', 'src', 'go',
    (n, s) => `go build ${n}.${s}`,
    (n, s) => `./${n}`)

languages[Lang.node] = new LanguageDef(null, 'node', 'src', 'js',
    null,
    (n, s) => `/usr/local/bin/node ${n}.${s}`)

languages[Lang.ruby] = new LanguageDef(null, 'ruby', 'src', 'rb',
    null,
    (n, s) => `/usr/local/bin/ruby ${n}.${s}`)

languages[Lang.perl] = new LanguageDef(null, 'perl', 'src', 'pl',
    null,
    (n, s) => `/usr/local/bin/perl ${n}.${s}`)

languages[Lang.haskell] = new LanguageDef('haskell', 'haskell', 'src', 'hs',
    (n, s) => `ghc -o src -O ${n}.${s}`,
    (n, s) => `./src`)

languages[Lang.rust] = new LanguageDef('rust', 'rust', 'src', 'rs',
    (n, s) => `rustc -o src -O ${n}.${s}`,
    (n, s) => `./src`)

languages[Lang.swift] = new LanguageDef('swift', 'swift', 'src', 'swift',
    (n, s) => `swiftc -O ${n}.${s}`,
    (n, s) => `./src`)

