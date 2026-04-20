/**
 * 知剧AI - 全站SEO集中配置
 * 所有页面的 TDK 在此统一管理，修改后运行 npm run generate:prod 重新打包即可生效
 */

export interface PageSeo {
  title: string
  description: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

/** 站点全局常量 */
export const siteConfig = {
  siteName: '知剧AI',
  siteUrl: 'https://www.zhijuu.com',
  defaultOgImage: 'https://www.zhijuu.com/og-default.png',
  /** 全站通用关键词，自动追加到每个页面的 keywords 末尾 */
  commonKeywords: '知剧,知剧AI,zhijuu,AI短剧,短剧创作平台',
}

/**
 * 各页面 SEO 配置（精确路由匹配）
 * 改 TDK 只改这里，改完 generate 一下就行，不用动页面代码
 */
export const seoConfig: Record<string, PageSeo> = {
  '/': {
    title: '知剧AI - 智能短剧创作平台 | AI编剧 | 小说转剧本 | 剧本生成',
    description: '知剧AI是专业的AI短剧创作平台，提供智能编剧、小说转剧本、AI剧本生成等功能。覆盖分集大纲、角色设计、台本生成、分镜脚本全流程，让短剧创作效率提升10倍。',
    keywords: 'AI编剧,短剧创作,剧本生成,小说转剧本,AI写剧本,智能编剧,短剧剧本,AI剧本创作',
    ogTitle: '知剧AI - 智能短剧创作平台',
    ogDescription: '从创意到成片剧本，全流程智能辅助。AI自动生成分集大纲、角色对白、分镜脚本，让短剧创作效率提升10倍。',
  },
}

export function getSeoByRoute(path: string): PageSeo | null {
  return seoConfig[path] || null
}

/**
 * 拼接完整的 keywords = 页面关键词 + 全站通用关键词
 */
export function getFullKeywords(pageSeo: PageSeo): string {
  const pageKw = pageSeo.keywords || ''
  return pageKw
    ? `${pageKw},${siteConfig.commonKeywords}`
    : siteConfig.commonKeywords
}
