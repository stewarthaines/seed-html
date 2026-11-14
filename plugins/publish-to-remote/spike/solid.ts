// Phase 0 spike (process/SOLID_DESTINATION.md): can a same-origin plugin iframe
// hold a Solid-OIDC session? Dev only; not part of the plugin build.
import { EVENTS, Session } from '@inrupt/solid-client-authn-browser'
import { createDpopHeader, generateDpopKeyPair } from '@inrupt/solid-client-authn-core'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const params = new URLSearchParams(location.search)
const pageUrl = location.origin + location.pathname

if (params.get('popup') === '1') sessionStorage.setItem('spike-mode', 'popup')
const mode =
  sessionStorage.getItem('spike-mode') === 'popup'
    ? 'popup'
    : window.top !== window
      ? 'frame'
      : 'top'
$('mode').textContent = mode

// The log survives this window's own redirects (sessionStorage) and is shared
// with the other windows of the spike (BroadcastChannel).
const channel = new BroadcastChannel('solid-spike')
const logKey = 'spike-log'
const logEl = $('log')
logEl.textContent = sessionStorage.getItem(logKey) ?? ''
function write(line: string) {
  logEl.textContent += line + '\n'
  sessionStorage.setItem(logKey, logEl.textContent ?? '')
  logEl.scrollTop = logEl.scrollHeight
}
function log(...parts: unknown[]) {
  const text = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
  const line = `${new Date().toISOString().slice(11, 19)} [${mode}] ${text}`
  write(line)
  channel.postMessage(line)
}
channel.onmessage = (e) => write(String(e.data))

const issuer = () => $<HTMLInputElement>('issuer').value.trim()
const folder = () => {
  const v = $<HTMLInputElement>('folder').value.trim()
  return v.endsWith('/') ? v : v + '/'
}
const clientIdUrl = () => folder() + 'seed-client.jsonld'
const useClientId = () => localStorage.getItem('spike-use-client-id') === '1'
$<HTMLInputElement>('useClientId').checked = useClientId()
$<HTMLInputElement>('useClientId').onchange = (e) =>
  localStorage.setItem('spike-use-client-id', (e.target as HTMLInputElement).checked ? '1' : '0')

const session = new Session()
session.events.on(EVENTS.ERROR, ((error: string | null, desc: string | null) =>
  log('ERROR event', error, desc)) as never)
session.events.on(EVENTS.SESSION_RESTORED, (url: string) => log('SESSION_RESTORED', url))
session.events.on(EVENTS.SESSION_EXPIRED, () => log('SESSION_EXPIRED'))
session.events.on(EVENTS.NEW_REFRESH_TOKEN, () => log('NEW_REFRESH_TOKEN'))

function showWho() {
  $('who').textContent = session.info.isLoggedIn ? `signed in as ${session.info.webId}` : 'not signed in'
}

async function signIn() {
  const options: Parameters<Session['login']>[0] = {
    oidcIssuer: issuer(),
    redirectUrl: pageUrl,
    clientName: 'SEED.html (spike)',
  }
  if (useClientId()) options.clientId = clientIdUrl()
  log('login()', { ...options })
  await session.login(options)
}

async function testWrite() {
  const url = folder() + 'hello.txt'
  const body = `Written from the ${mode} at ${new Date().toISOString()}\n`
  const put = await authFetch()(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body,
  })
  log('PUT', url, put.status)
  const head = await authFetch()(url, { method: 'HEAD' })
  log('WAC-Allow (signed in)', head.headers.get('WAC-Allow'))
  const anon = await fetch(url, { cache: 'no-store' })
  log('anonymous GET', anon.status, anon.headers.get('WAC-Allow'))
  return put.ok
}

// --- Relay flow: the popup only carries the authorization code back; the
// frame registers the client, holds the DPoP key and exchanges the code, then
// keeps a refresh token (localStorage) and the non-extractable key (IndexedDB).
type DpopKey = Awaited<ReturnType<typeof generateDpopKeyPair>>
let relay: { accessToken: string; key: DpopKey; webId?: string } | null = null

function authFetch(): typeof fetch {
  if (!relay) return session.fetch
  const { accessToken, key } = relay
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `DPoP ${accessToken}`)
    headers.set('DPoP', await createDpopHeader(url, method, key))
    return fetch(input, { ...init, headers })
  }
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const randomString = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

async function issuerConfig() {
  const res = await fetch(new URL('.well-known/openid-configuration', issuer()))
  return res.json()
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('solid-spike', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('keys')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbPut(name: string, value: unknown) {
  const db = await idb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite')
    tx.objectStore('keys').put(value, name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGet<T>(name: string): Promise<T | undefined> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('keys').objectStore('keys').get(name)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function tokenRequest(body: Record<string, string>, key: DpopKey) {
  const config = await issuerConfig()
  const res = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      DPoP: await createDpopHeader(config.token_endpoint, 'POST', key),
    },
    body: new URLSearchParams(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${JSON.stringify(json)}`)
  return json as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string; scope?: string }
}

function webIdFromIdToken(idToken?: string) {
  if (!idToken) return undefined
  const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  return (payload.webid ?? payload.sub) as string
}

async function acceptTokens(tokens: Awaited<ReturnType<typeof tokenRequest>>, key: DpopKey) {
  const webId = webIdFromIdToken(tokens.id_token) ?? relay?.webId ?? localStorage.getItem('relay-webid') ?? undefined
  relay = { accessToken: tokens.access_token, key, webId }
  if (webId) localStorage.setItem('relay-webid', webId)
  if (tokens.refresh_token) localStorage.setItem('relay-refresh', tokens.refresh_token)
  log('relay tokens', {
    webId,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    refreshToken: tokens.refresh_token ? 'yes' : 'NO',
  })
  $('who').textContent = `frame holds tokens for ${webId}`
}

async function relaySignIn(popup: Window | null) {
  log('relay popup', popup ? 'opened on click' : 'BLOCKED')
  if (!popup) return
  const config = await issuerConfig()
  let clientId = localStorage.getItem('relay-client-id')
  if (useClientId()) clientId = clientIdUrl()
  if (!clientId) {
    const reg = await fetch(config.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'SEED.html (spike, relay)',
        application_type: 'web',
        redirect_uris: [pageUrl],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid webid offline_access',
      }),
    })
    const json = await reg.json()
    log('registration', reg.status, { client_id: json.client_id, auth: json.token_endpoint_auth_method })
    if (!reg.ok) {
      popup.close()
      return
    }
    clientId = json.client_id as string
    localStorage.setItem('relay-client-id', clientId)
  }
  const verifier = randomString()
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const state = randomString()
  localStorage.setItem('relay-state', state)
  const auth = new URL(config.authorization_endpoint)
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pageUrl,
    response_type: 'code',
    scope: 'openid webid offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'consent',
  }).toString()
  popup.location.href = auth.href
  log('relay popup sent to the provider', { clientId })
  const code = await new Promise<string>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'solid-relay-code') return
      window.removeEventListener('message', onMessage)
      if (e.data.state !== state) reject(new Error('state mismatch'))
      else if (e.data.error) reject(new Error(`${e.data.error}: ${e.data.description}`))
      else resolve(e.data.code)
    }
    window.addEventListener('message', onMessage)
  })
  log('relay code received in frame')
  const key = await generateDpopKeyPair(false)
  const tokens = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: pageUrl, client_id: clientId, code_verifier: verifier },
    key,
  )
  await idbPut('dpop', key)
  await acceptTokens(tokens, key)
}

async function relayRestore() {
  const refreshToken = localStorage.getItem('relay-refresh')
  const clientId = useClientId() ? clientIdUrl() : localStorage.getItem('relay-client-id')
  const key = await idbGet<DpopKey>('dpop')
  log('relay restore', {
    refreshToken: !!refreshToken,
    clientId,
    key: key ? `extractable=${key.privateKey.extractable}` : 'none',
  })
  if (!refreshToken || !clientId || !key) return
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }, key)
  await acceptTokens(tokens, key)
}

async function makePublic() {
  const head = await authFetch()(folder(), { method: 'HEAD' })
  const link = head.headers.get('Link') ?? ''
  const match = link.match(/<([^>]+)>;\s*rel="acl"/)
  const aclUrl = match ? new URL(match[1], folder()).href : folder() + '.acl'
  const webId = relay?.webId ?? session.info.webId
  const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
<#owner> a acl:Authorization; acl:agent <${webId}>; acl:accessTo <./>; acl:default <./>; acl:mode acl:Read, acl:Write, acl:Control.
<#public> a acl:Authorization; acl:agentClass foaf:Agent; acl:accessTo <./>; acl:default <./>; acl:mode acl:Read.
`
  const put = await authFetch()(aclUrl, { method: 'PUT', headers: { 'Content-Type': 'text/turtle' }, body: acl })
  log('PUT acl', aclUrl, put.status)
  const anon = await fetch(folder() + 'hello.txt', { cache: 'no-store' })
  log('anonymous GET hello.txt', anon.status, anon.headers.get('WAC-Allow'))
}

async function main() {
  // A relay popup: hand the code to the opener and close, before the Inrupt
  // session sees it.
  const relayState = localStorage.getItem('relay-state')
  if (window.opener && params.get('state') && params.get('state') === relayState) {
    localStorage.removeItem('relay-state')
    window.opener.postMessage(
      {
        type: 'solid-relay-code',
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
        description: params.get('error_description'),
      },
      location.origin,
    )
    log('relay popup handed the code to the opener')
    window.close()
    return
  }
  const restore = sessionStorage.getItem('spike-restore') === '1'
  sessionStorage.removeItem('spike-restore')
  const hadCode = params.has('code')
  const hadError = params.get('error')
  if (hadError) log('provider returned error', hadError, params.get('error_description'))
  try {
    const info = await session.handleIncomingRedirect({
      url: location.href,
      restorePreviousSession: restore,
    })
    log('handleIncomingRedirect', { hadCode, restore, isLoggedIn: info?.isLoggedIn, webId: info?.webId })
  } catch (err) {
    log('handleIncomingRedirect threw', String(err))
  }
  showWho()
  const stored = Object.keys(localStorage).filter((k) => k.startsWith('solidClientAuthn') || k.startsWith('oidc'))
  log('localStorage keys', stored)

  if (mode === 'popup' && params.get('popup') === '1') {
    // Fresh popup: go straight to the provider.
    const iss = params.get('issuer')
    if (iss) $<HTMLInputElement>('issuer').value = iss
    const f = params.get('folder')
    if (f) $<HTMLInputElement>('folder').value = f
    await signIn()
    return
  }
  if (mode === 'popup' && session.info.isLoggedIn) {
    let wrote = false
    try {
      wrote = await testWrite()
    } catch (err) {
      log('popup write threw', String(err))
    }
    window.opener?.postMessage(
      { type: 'solid-spike-auth', webId: session.info.webId, wrote },
      location.origin,
    )
    log('told the opener; this popup can close')
  }
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'solid-spike-auth') return
  log('popup reported', e.data, '— frame session isLoggedIn:', session.info.isLoggedIn)
  window.parent?.postMessage({ from: 'frame', ...e.data }, location.origin)
})

$('popup').onclick = () => {
  const u = new URL(pageUrl)
  u.searchParams.set('popup', '1')
  u.searchParams.set('issuer', issuer())
  u.searchParams.set('folder', folder())
  const w = window.open(u, 'solid-login', 'popup,width=520,height=720')
  log('window.open', w ? 'opened' : 'BLOCKED')
}
$('restore').onclick = () => {
  sessionStorage.setItem('spike-restore', '1')
  log('reloading to restore silently')
  location.reload()
}
$('inframe').onclick = () => signIn().catch((err) => log('login threw', String(err)))
$('relay').onclick = () =>
  // Open on the click itself: Safari blocks a popup opened after awaits.
  relaySignIn(window.open('about:blank', 'solid-relay', 'popup,width=520,height=720')).catch((err) => log('relay threw', String(err)))
$('relayRestore').onclick = () => relayRestore().catch((err) => log('relay restore threw', String(err)))
$('makePublic').onclick = () => makePublic().catch((err) => log('make public threw', String(err)))
$('write').onclick =() => testWrite().catch((err) => log('write threw', String(err)))
$('list').onclick = async () => {
  try {
    const res = await authFetch()(folder(), { headers: { Accept: 'text/turtle' } })
    log('GET folder', res.status, await res.text())
  } catch (err) {
    log('list threw', String(err))
  }
}
$('clientid').onclick = async () => {
  const doc = {
    '@context': ['https://www.w3.org/ns/solid/oidc-context.jsonld'],
    client_id: clientIdUrl(),
    client_name: 'SEED.html (spike)',
    client_uri: 'https://readitinabook.com/',
    redirect_uris: [pageUrl],
    post_logout_redirect_uris: [pageUrl],
    scope: 'openid profile offline_access webid',
    grant_types: ['refresh_token', 'authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
  }
  try {
    const res = await authFetch()(clientIdUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(doc, null, 2),
    })
    log('PUT client id document', clientIdUrl(), res.status)
  } catch (err) {
    log('client id PUT threw', String(err))
  }
}
$('logout').onclick = async () => {
  await session.logout({ logoutType: 'app' })
  log('signed out (app)')
  showWho()
}
$('clear').onclick = () => {
  sessionStorage.removeItem(logKey)
  logEl.textContent = ''
}

main()
