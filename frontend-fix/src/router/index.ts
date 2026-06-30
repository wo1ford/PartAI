import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', name: 'login', component: () => import('@/pages/LoginPage.vue') }],
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue') },
      { path: 'calendar', name: 'calendar', component: () => import('@/pages/CalendarPage.vue') },
      { path: 'materials', name: 'materials', component: () => import('@/pages/MaterialsPage.vue') },
      { path: 'materials/disk', name: 'disk', component: () => import('@/pages/DiskPage.vue') },
      { path: 'departments', name: 'departments', component: () => import('@/pages/DepartmentsPage.vue') },
      { path: 'departments/:id', name: 'department', component: () => import('@/pages/DepartmentDetailPage.vue') },
      { path: 'employees', name: 'employees', component: () => import('@/pages/EmployeesPage.vue') },
      { path: 'chat', name: 'chat', component: () => import('@/pages/ChatPage.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)

  if (requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
  if (auth.isAuthenticated) {
    const office = useOfficeStore()
    if (office.offices.length === 0) await office.load()
  }
  return true
})
