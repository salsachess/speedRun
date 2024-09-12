import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import PConfig from '../pages/PConfig.vue'
import PGames from '../pages/PGames.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'config',
    component: PConfig
  },
  {
    path: '/games/:nick/:startTs?/:timeClass?/:rules?',
    name: 'games',
    component: PGames,
    props: (route) => ({
      startTs: route.params.startTs ? parseInt(route.params.startTs as string) : null,
      nick: route.params.nick || null,
      timeClass: route.params.timeClass || null,
      rules: route.params.rules || null
    })
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: { name: 'config' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
