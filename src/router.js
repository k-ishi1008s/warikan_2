// router.js
import { createRouter, createWebHistory } from 'vue-router'
import SessionCreatePage from './pages/SessionCreatePage.vue'
import SessionPage from './pages/SessionPage.vue'
import MemberEditPage from './pages/MemberEditPage.vue'
import ExpenseEditPage from './pages/ExpenseEditPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: SessionCreatePage },
    { path: '/s/:id/:token', component: SessionPage, name: 'session' },
    { path: '/s/:id/:token/edit', component: MemberEditPage, name: 'member-edit' },
    {
      path: '/s/:id/:token/expense/:expId/edit',
      component: ExpenseEditPage,
      name: 'expense-edit'
    }
  ]
})