import 'primeicons/primeicons.css'
import './assets/tokens.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import App from './App.vue'
import { router } from './router/index.ts'
import { AppTheme } from './app/theme.ts'
import { useAuthStore } from './stores/auth.store.ts'

async function bootstrap(): Promise<void> {
  const app = createApp(App)

  app.use(createPinia())
  app.use(PrimeVue, {
    theme: {
      preset: AppTheme,
      options: {
        darkModeSelector: false,
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue, app',
        },
      },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)

  // Восстанавливаем сессию (мок) до монтирования и навигации.
  const auth = useAuthStore()
  await auth.restore()

  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
