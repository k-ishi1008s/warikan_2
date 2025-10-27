<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../api/supabase'

const router = useRouter()
const title = ref('')
const membersText = ref('A\nB\nC')
const loading = ref(false)

// 128bit相当のランダムトークン
function genToken(bits = 128) {
  const bytes = bits / 8
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
}

async function createSession() {
  if (!title.value.trim()) return alert('タイトルを入れてください')
  const names = membersText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (names.length === 0) return alert('メンバーを1人以上入れてください')

  loading.value = true
  const token = genToken()

  // 1) sessions へ作成
  const { data: sess, error: e1 } = await supabase
    .from('sessions')
    .insert([{ title: title.value, token }])
    .select('id')
    .single()

  if (e1 || !sess) {
    loading.value = false
    return alert(e1?.message ?? 'sessions insert 失敗')
  }

  // 2) members を一括作成
  const rows = names.map(n => ({ session_id: sess.id, name: n, active: true }))
  const { error: e2 } = await supabase.from('members').insert(rows)
  if (e2) {
    loading.value = false
    return alert(e2.message)
  }

  loading.value = false

  // 3) ここで“自動で”詳細ページURLへ遷移！
  router.push(`/s/${sess.id}/${token}`)
}
</script>

<template>
  <main style="max-width:680px;margin:40px auto;padding:16px;">
    <h1>セッション作成</h1>
    <label>タイトル</label>
    <input v-model="title" placeholder="旅行 1日目" style="width:100%;padding:8px;margin:8px 0;" />
    <label>メンバー（1行に1人）</label>
    <textarea v-model="membersText" rows="6" style="width:100%;padding:8px;margin:8px 0;"></textarea>
    <button :disabled="loading" @click="createSession">作成して入室リンクへ</button>
  </main>
</template>