import { createRouter, createWebHistory } from 'vue-router'
import PConfig from '../pages/PConfig.vue'
import PGames from '../pages/PGames.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'config',
      component: PConfig
    },
    {
      path: '/games/nick/:nick?/startTS/:startTs?/timeClass/:timeClass?',
      name: 'games',
      component: PGames,
      props: (route) => ({
        startTs: parseInt(route.params.startTs as string) || null,
        nick: (route.params.nick as string) || null,
        timeClass: (route.params.timeClass as string) || null
      })
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'config' }
    }
  ]
})

export default router
