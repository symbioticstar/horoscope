export const images: Record<string, [string, number]> = {
    'gcc': ['gcc', 8000],
    'python': ['python', 8001],
    'java': ['openjdk:11', 8002],
    'rust': ['rust', 8003],
    'ojcmp': ['registry.cn-hangzhou.aliyuncs.com/kazune/ojcmp:1.0', 8004],
}

export type ImageRecord = typeof images;