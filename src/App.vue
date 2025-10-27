<template>
  <header class="header">
    <div class="brand">
      <div class="brand-logo"></div>
      <div class="brand-name">waliga</div>
      <div style="margin-left:auto; display:flex; gap:8px;">
        <router-link to="/" style="text-decoration:none;">
          <button class="ghost">新しいセッション</button>
        </router-link>
      </div>
    </div>
  </header>
  <router-view />
</template>