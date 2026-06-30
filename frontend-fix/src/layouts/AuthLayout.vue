<script setup lang="ts"></script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__art" aria-hidden="true">
      <span class="logo-box"><span class="logo-inner" /></span>
      <h2>Новые люди</h2>
      <p>Единая рабочая платформа офисов партии: задачи, статистика, материалы.</p>
    </div>
    <div class="auth-layout__panel">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.auth-layout { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; }
.auth-layout__art {
  background: linear-gradient(150deg, var(--c-primary) 0%, var(--c-primary-700) 100%);
  color: #fff;
  display: flex; flex-direction: column; justify-content: center; gap: 18px;
  padding: 64px;
}
.auth-layout__art h2 { color: #fff; font-size: 30px; }
.auth-layout__art p { max-width: 360px; opacity: 0.9; line-height: 1.5; }
.logo-box { width: 58px; height: 58px; background: rgba(255, 255, 255, 0.16); border-radius: 16px; display: grid; place-items: center; margin-bottom: 8px; }
.logo-inner { width: 24px; height: 24px; background: #fff; border-radius: 8px; }
.auth-layout__panel { display: grid; place-items: center; padding: 32px; background: var(--c-bg); }
@media (max-width: 880px) { .auth-layout { grid-template-columns: 1fr; } .auth-layout__art { display: none; } }
</style>
