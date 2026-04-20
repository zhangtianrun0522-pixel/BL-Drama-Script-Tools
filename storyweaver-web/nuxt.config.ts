export default defineNuxtConfig({
  ssr: false,

  runtimeConfig: {
    public: {
      apiBase: 'http://127.0.0.1:7006',
    },
  },

  devServer: {
    port: 7005,
    host: '127.0.0.1',
  },

  vite: {
    server: {
      allowedHosts: true,
    },
  },

  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxt/icon'],

  icon: {
    serverBundle: false,
    clientBundle: { scan: true },
  },

  routeRules: {
    '/**': { ssr: false },
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'StoryWeaver — BL短剧AI创作台',
      meta: [
        { name: 'description', content: 'BL短剧AI创作工作台' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  compatibilityDate: '2024-04-03',
})
