import { createRouter, createWebHistory } from 'vue-router'
import SessionCreatePage from './pages/SessionCreatePage.vue'
import SessionPage from './pages/SessionPage.vue'
import MemberEditPage from './pages/MemberEditPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: SessionCreatePage },
    { path: '/s/:id/:token', component: SessionPage },
    { path: '/s/:id/:token/edit', component: MemberEditPage }
  ]
})