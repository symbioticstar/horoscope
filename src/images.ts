export const images: Record<string, [string, number]> = {
    'gcc': ['gcc', 8000],
    'python': ['python', 8001],
    'java': ['openjdk:11', 8002],
    'rust': ['rust', 8003],
    'ojcmp': ['registry.cn-hangzhou.aliyuncs.com/kazune/ojcmp:1.0', 8004],
    'golang': ['golang', 8005],
    'ruby': ['ruby', 8006],
    'node': ['node', 8007],
    'perl': ['perl', 8010],
    'haskell': ['haskell', 8013],
    'swift': ['swift', 8015],
}

export type ImageRecord = typeof images;