import { createRouter, createWebHistory } from 'vue-router'
import SessionCreatePage from './pages/SessionCreatePage.vue'
import SessionPage from './pages/SessionPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: SessionCreatePage },
    { path: '/s/:id/:token', component: SessionPage }
  ]
})