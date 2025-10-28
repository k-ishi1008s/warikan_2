<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'

const route = useRoute()
const router = useRouter()
const sessionId = route.params.id
const token = route.params.token

// RLS用にトークンヘッダ付きクライアント
const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: { headers: { 'x-session-token': String(token) } },
    auth: { persistSession: false, autoRefreshToken: false }
  }
)

const title = ref('')
const createdAt = ref('')
const members = ref([]) // {id,name,active}[]
const loading = ref(false)

// 新規メンバー
const newMember = ref('')
const addLoading = ref(false)

async function load() {
  const { data: s, error: se } = await db.from('sessions')
    .select('id,title,created_at').eq('id', sessionId).eq('token', token).single()
  if (se || !s) { alert('セッションが見つかりません'); return router.push('/') }
  title.value = s.title ?? ''
  createdAt.value = s.created_at

  const { data: m } = await db.from('members')
    .select('id,name,active').eq('session_id', sessionId).order('id')
  members.value = m ?? []
}

async function saveTitle() {
  if (!title.value.trim()) return alert('タイトルを入れてください')
  loading.value = true
  const { error } = await db.from('sessions').update({ title: title.value }).eq('id', sessionId)
  loading.value = false
  if (error) return alert(error.message)
  alert('タイトルを保存しました')
}

async function addMember() {
  const n = newMember.value.replace(/\s+/g,' ').trim()
  if (!n) return
  if (members.value.some(m => m.name === n && m.active)) {
    newMember.value = ''; return
  }
  addLoading.value = true
  const { data, error } = await db.from('members')
    .insert([{ session_id: sessionId, name: n, active: true }])
    .select('id,name,active').single()
  addLoading.value = false
  if (error) return alert(error.message)
  members.value.push(data)
  newMember.value = ''
}

async function deactivateMember(id) {
  if (!confirm('このメンバーを非表示にしますか？（既存の出費は残ります）')) return
  const { error } = await db.from('members').update({ active: false }).eq('id', id)
  if (error) return alert(error.message)
  const idx = members.value.findIndex(m => m.id === id)
  if (idx >= 0) members.value[idx].active = false
}

onMounted(load)

function backToSession() {
  router.push(`/s/${sessionId}/${token}`)
}
</script>

<template>
  <main class="container" style="display:flex; flex-direction:column; gap:14px;">
    <div class="card" style="display:flex; flex-direction:column; gap:10px;">
      <h3 style="margin:0;">イベント名</h3>
      <div class="row" style="gap:8px; align-items:center;">
        <input v-model="title" placeholder="名古屋旅行" style="flex:1; height:40px;" />
        <button class="ghost" :disabled="loading" @click="saveTitle" style="height:40px; padding:0 14px;">保存</button>
      </div>
      <div class="small">作成日: {{ new Date(createdAt).toLocaleDateString('ja-JP', { year:'numeric', month:'short', day:'numeric' }) }}</div>
    </div>

    <div class="card" style="display:flex; flex-direction:column; gap:10px;">
      <h3 style="margin:0;">メンバー</h3>

      <!-- 追加行（1行・省スペース） -->
      <div class="row" style="gap:8px; align-items:center;">
        <input
          v-model="newMember"
          placeholder="さかした"
          @keyup.enter.prevent="addMember"
          autocomplete="off"
          style="flex:1; height:40px;"
        />
        <button class="ghost" :disabled="addLoading" @click="addMember" style="height:40px; padding:0 14px;">追加</button>
      </div>

      <!-- 一覧（activeな人は通常、inactiveは薄く） -->
      <div class="row" style="gap:6px; flex-wrap:wrap;">
        <span
          v-for="m in members"
          :key="m.id"
          :style="`
            display:inline-flex; align-items:center; gap:6px;
            padding:4px 8px; border:1px solid #eee; border-radius:999px; background:#fff; font-size:11px; font-weight: 700;
            opacity:${m.active ? 1 : 0.5};
          `"
        >
          {{ m.name }}
          <button v-if="m.active" class="edit" style="padding:2px 6px;"
            @click="deactivateMember(m.id)">×</button>
          <span v-else class="small">(非表示)</span>
        </span>
      </div>
    </div>
    <button class="btn-register" @click="backToSession" style="width:100%;">戻る</button>
  </main>
</template>
