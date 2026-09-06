import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/game/:id', name: 'game', component: () => import('../views/GameView.vue') },
    { path: '/saved-games/save/:name', name: 'save-game', component: () => import('../views/SavedGamesView.vue') },
    { path: '/saved-games/load', name: 'load-games', component: () => import('../views/SavedGamesView.vue') },
    { path: '/saved-games/load/:name', name: 'load-game', component: () => import('../views/SavedGamesView.vue') },
    { path: '/settings', redirect: '/settings/session' },
    { path: '/settings/:category(session|gameplay|appearance|engines)', name: 'settings', component: () => import('../views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
});

export default router;
