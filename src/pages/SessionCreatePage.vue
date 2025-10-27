<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../api/supabase'

const router = useRouter()
const title = ref('')
const membersText = ref('A\nB\nC')
const loading = ref(false)

function genToken(bits = 128) {
  const a = new Uint8Array(bits/8); crypto.getRandomValues(a)
  return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')
}

async function createSession() {
  if (!title.value.trim()) return alert('タイトルを入れてください')
  const names = membersText.value.split('\n').map(s=>s.trim()).filter(Boolean)
  if (names.length === 0) return alert('メンバーを1人以上入れてください')

  loading.value = true
  const token = genToken()

  const { data: sess, error: e1 } = await supabase
    .from('sessions').insert([{ title: title.value, token }]).select('id').single()
  if (e1 || !sess) { loading.value=false; return alert(e1?.message ?? 'sessions insert失敗') }

  const rows = names.map(n => ({ session_id: sess.id, name: n, active: true }))
  const { error: e2 } = await supabase.from('members').insert(rows)
  if (e2) { loading.value=false; return alert(e2.message) }

  loading.value = false
  router.push(`/s/${sess.id}/${token}`)
}
</script>

<template>
  <main class="container">
    <div class="card">
      <h2 style="margin:0 0 8px">セッション作成</h2>
      <p class="small">スマホで使いやすいように最小入力だけ</p>
      <div class="spacer"></div>

      <label class="small">タイトル</label>
      <input v-model="title" placeholder="沖縄旅行 Day1" />

      <div class="spacer"></div>
      <label class="small">メンバー（1行に1人）</label>
      <textarea v-model="membersText" rows="6" placeholder="A&#10;B&#10;C"></textarea>

      <div class="spacer"></div>
      <button :disabled="loading" @click="createSession" style="width:100%">作成して入室</button>
    </div>
  </main>
</template>