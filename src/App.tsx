import { useEffect, useState } from 'react'
import './App.css'

type Mode = 'solo' | 'versus'
type Direction = 'up' | 'right' | 'down' | 'left'
type RoomKind = 'samples' | 'analysis' | 'energy' | 'security' | 'archive' | 'anomaly' | 'medical' | 'meeting' | 'workshop' | 'teleport' | 'office' | 'lounge'
type CardKind = 'heal' | 'dash' | 'scan' | 'locate' | 'breach' | 'vitalCore' | 'firstAid' | 'combatSerum' | 'jammer' | 'prediction' | 'thorns'
type Role = 'athlete' | 'warrior' | 'scholar' | 'bountyHunter'
type Pos = { r: number; c: number }
type Room = { id: string; r: number; c: number; kind: RoomKind; doors: Direction[]; depleted?: boolean; meetingReady?: number }
type Card = { id: string; kind: CardKind; direction?: Direction }
type Player = { id: 'p1' | 'ai'; name: string; role: Role; pos: Pos; hp: number; maxHp: number; attack: number; score: number; hand: Card[]; seen: string[]; shields: number; doubleDraw: number; turns: number; skillReady: number; movementLocked: number; predictedDirection?: Direction; trackingEnemy: boolean; revealedUntil: number; directionBag: Direction[]; directionBagPos: string }
type Game = { mode: Mode; rooms: Room[]; players: Player[]; current: number; turn: number; log: string[]; winner?: string; phase: 'draw' | 'play' | 'discard' | 'teleport' | 'scholarPick' | 'airdropUpgrade'; pendingCard?: Card; pendingSkill?: boolean; scholarChoices?: Card[]; airdropRoomId?: string; airdropTurn: number; airdropNotice?: string; roomNotice?: { title: string; text: string; icon: string }; acted: boolean }

const dirs: Record<Direction, Pos> = { up: { r: -1, c: 0 }, right: { r: 0, c: 1 }, down: { r: 1, c: 0 }, left: { r: 0, c: -1 } }
const dirIcon: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' }
const opposite: Record<Direction, Direction> = { up: 'down', right: 'left', down: 'up', left: 'right' }
const kindData: Record<RoomKind, { name: string; icon: string; type: 'once' | 'repeat' | 'blank'; desc: string }> = {
  samples: { name: '样本库', icon: '◈', type: 'once', desc: '+2 积分' }, analysis: { name: '分析实验室', icon: '⌁', type: 'once', desc: '+1 积分，侦察' }, energy: { name: '能源中心', icon: '⚡', type: 'once', desc: '下次抽 2 张' }, security: { name: '安保室', icon: '⬡', type: 'once', desc: '获得护盾' }, archive: { name: '档案室', icon: '▤', type: 'once', desc: '揭示四邻格' }, anomaly: { name: '异常隔离室', icon: '◉', type: 'once', desc: '受 2 伤害，+3 积分' },
  medical: { name: '医疗室', icon: '✚', type: 'repeat', desc: '回复 3 生命' }, meeting: { name: '会议室', icon: '◫', type: 'repeat', desc: '+1 积分（冷却 5 回合）' }, workshop: { name: '维修间', icon: '⚙', type: 'repeat', desc: '获得开辟卡' }, teleport: { name: '传送实验室', icon: '↯', type: 'repeat', desc: '传送至已探索房间' },
  office: { name: '空置办公室', icon: '□', type: 'blank', desc: '无效应' }, lounge: { name: '休息室', icon: '◌', type: 'blank', desc: '无效应' },
}
const cardData: Record<CardKind, { name: string; icon: string; desc: string }> = {
  heal: { name: '修复协议', icon: '✚', desc: '回复 3 点生命' }, dash: { name: '冲刺协议', icon: '↠', desc: '选择方向，一路冲至无法继续' }, scan: { name: '扫描阵列', icon: '⌘', desc: '永久揭示上下左右' }, locate: { name: '信标追踪', icon: '◎', desc: '揭示敌方坐标' }, breach: { name: '开辟装置', icon: '⊞', desc: '永久打开一面相邻墙' }, vitalCore: { name: '生命核心', icon: '♥', desc: '生命上限 +1，回复 1 点生命' }, firstAid: { name: '应急凝胶', icon: '✦', desc: '回复 1 点生命' }, combatSerum: { name: '战斗血清', icon: '▲', desc: '攻击力 +1' }, jammer: { name: '静默干扰器', icon: '▣', desc: '封锁对手下次移动' }, prediction: { name: '轨迹推演', icon: '⌁', desc: '猜测对手下次移动方向' }, thorns: { name: '反噬荆棘', icon: '✳', desc: '令对手承受其攻击力一半伤害' },
}
const roleData: Record<Role, { name: string; hp: number; attack: number; skill: string; cooldown: number; desc: string }> = { athlete: { name: '运动员', hp: 15, attack: 2, skill: '矫健身姿', cooldown: 2, desc: '任意方向移动一格。冷却 2 回合。' }, warrior: { name: '战士', hp: 15, attack: 3, skill: '战斗本能', cooldown: 5, desc: '若敌人在 2 步内，突进并以双倍攻击结算。初始冷却 3 回合，此后冷却 5 回合。' }, scholar: { name: '学者', hp: 10, attack: 2, skill: '感知万物', cooldown: 0, desc: '每次抽牌从三张行动卡中选择一张；属性增益翻倍。' }, bountyHunter: { name: '赏金猎人', hp: 12, attack: 3, skill: '空投感知', cooldown: 0, desc: '被动：空投投放时自动探索其所在房间。' } }
const rand = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const key = (p: Pos) => `${p.r}-${p.c}`
const eq = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c
const at = (rooms: Room[], p: Pos) => rooms.find((room) => room.r === p.r && room.c === p.c)
const move = (p: Pos, d: Direction): Pos => ({ r: p.r + dirs[d].r, c: p.c + dirs[d].c })
const randomCard = (mode: Mode, game?: Game, player?: Player): Card => { const roll = Math.random() * 100; const kind: CardKind = roll < 2 ? 'combatSerum' : roll < 5 ? 'vitalCore' : roll < 8 ? 'thorns' : roll < 13 ? 'firstAid' : roll < 18 && mode === 'versus' ? 'jammer' : roll < 23 && mode === 'versus' ? 'prediction' : roll < 33 ? 'dash' : rand(mode === 'solo' ? ['heal', 'scan'] as CardKind[] : ['heal', 'scan', 'locate'] as CardKind[]); if (kind === 'dash') return { id: crypto.randomUUID(), kind }; const legalDirections = game && player ? (Object.keys(dirs) as Direction[]).filter((direction) => canMoveInState(game, player, direction)) : Object.keys(dirs) as Direction[]; let direction = rand(legalDirections.length ? legalDirections : Object.keys(dirs) as Direction[]); if (player && game && legalDirections.length) { const position = key(player.pos); if (player.directionBagPos !== position) { player.directionBagPos = position; player.directionBag = [] } if (!player.directionBag.length) player.directionBag = [...legalDirections].sort(() => Math.random() - .5); direction = player.directionBag.shift()! } return { id: crypto.randomUUID(), kind, direction } }
const canMoveInState = (game: Game, player: Player, direction: Direction) => { const room = at(game.rooms, player.pos); return !!room?.doors.includes(direction) && !!at(game.rooms, move(player.pos, direction)) }

function createMap(): { rooms: Room[]; spawns: Pos[] } {
  const target = 22 + Math.floor(Math.random() * 5)
  const cells: Pos[] = [{ r: 2, c: 2 }]
  while (cells.length < target) {
    const candidates = cells.flatMap((source) => (Object.keys(dirs) as Direction[]).map((d) => move(source, d)))
      .filter((next, index, all) => next.r >= 0 && next.r < 6 && next.c >= 0 && next.c < 6 && !cells.some((p) => eq(p, next)) && all.findIndex((p) => eq(p, next)) === index)
    const ranked = candidates.map((next) => {
      const all = [...cells, next]; const rows = all.map((p) => p.r); const cols = all.map((p) => p.c)
      const height = Math.max(...rows) - Math.min(...rows) + 1; const width = Math.max(...cols) - Math.min(...cols) + 1
      const edgeNeighbors = (Object.keys(dirs) as Direction[]).filter((d) => cells.some((p) => eq(p, move(next, d)))).length
      return { next, score: width * height * 12 + Math.min(width, height) * 8 - edgeNeighbors * 2 + Math.random() * 7 }
    }).sort((a, b) => b.score - a.score)
    cells.push(rand(ranked.slice(0, Math.max(1, Math.ceil(ranked.length * .32)))).next)
  }
  const kinds: RoomKind[] = ['office', 'lounge', 'samples', 'analysis', 'energy', 'security', 'archive', 'anomaly', 'medical', 'meeting', 'workshop', 'teleport']
  while (kinds.length < target) kinds.push(rand(kinds.slice(2)))
  const rooms: Room[] = cells.map((p, i) => ({ id: crypto.randomUUID(), ...p, kind: kinds[i], doors: [] as Direction[] }))
  rooms.forEach((room) => {
    ;(Object.keys(dirs) as Direction[]).forEach((d) => {
      const next = at(rooms, move(room, d)); if (!next || room.doors.includes(d)) return
      if (Math.random() < .5) { room.doors.push(d); next.doors.push(opposite[d]) }
    })
  })
  const reachable = () => {
    const visited = new Set<string>([key(rooms[0])]); const queue = [rooms[0]]
    while (queue.length) { const room = queue.shift()!; room.doors.forEach((d) => { const next = at(rooms, move(room, d)); if (next && !visited.has(key(next))) { visited.add(key(next)); queue.push(next) } }) }
    return visited
  }
  let connected = reachable()
  while (connected.size < rooms.length) {
    const bridge = rooms.flatMap((room) => (Object.keys(dirs) as Direction[]).map((d) => ({ room, d, next: at(rooms, move(room, d)) })))
      .find(({ room, next }) => next && connected.has(key(room)) && !connected.has(key(next)))
    if (!bridge?.next) break
    bridge.room.doors.push(bridge.d); bridge.next.doors.push(opposite[bridge.d])
    connected = reachable()
  }
  const blanks = rooms.filter((r) => r.kind === 'office' || r.kind === 'lounge')
  const far = blanks.filter((b) => Math.abs(b.r - blanks[0].r) + Math.abs(b.c - blanks[0].c) >= 3)
  return { rooms, spawns: [blanks[0], far[0] || blanks[1] || rooms[1]].map(({ r, c }) => ({ r, c })) }
}

function newGame(mode: Mode, role: Role): Game {
  const { rooms, spawns } = createMap(); const profile = roleData[role]; const p1: Player = { id: 'p1', name: '玩家', role, pos: spawns[0], hp: profile.hp, maxHp: profile.hp, attack: profile.attack, score: 0, hand: [], seen: [key(spawns[0])], shields: 0, doubleDraw: 0, turns: 0, skillReady: role === 'warrior' ? 3 : 0, movementLocked: 0, trackingEnemy: false, revealedUntil: 0, directionBag: [], directionBagPos: key(spawns[0]) }
  const aiRole = rand(Object.keys(roleData) as Role[]); const aiProfile = roleData[aiRole]; const ai: Player = { ...p1, id: 'ai', name: 'AI', role: aiRole, hp: aiProfile.hp, maxHp: aiProfile.hp, attack: aiProfile.attack, skillReady: aiRole === 'warrior' ? 3 : 0, pos: spawns[1], seen: [key(spawns[1])], hand: [] }
  const players = mode === 'solo' ? [p1] : [p1, ai]; const current = mode === 'versus' ? Math.floor(Math.random() * 2) : 0
  return { mode, rooms, players, current, turn: 1, log: [`研究所地图已建立。${players[current].name} 正在抽取首张行动卡。`], phase: 'draw', airdropTurn: 3, acted: false }
}

function App() {
  const [mode, setMode] = useState<Mode>('solo'); const [selectedRole, setSelectedRole] = useState<Role>('athlete'); const [game, setGame] = useState<Game>(() => newGame('solo', 'athlete'))
  const [guidePage, setGuidePage] = useState<'index' | 'rules' | 'airdrop' | RoomKind | CardKind>('index')
  const [guideIndex, setGuideIndex] = useState(0)
  const [showLobby, setShowLobby] = useState(true)
  const [lobbyStep, setLobbyStep] = useState<1 | 2 | 3 | 4>(1)
  const [lobbyMode, setLobbyMode] = useState<Mode>('solo')
  const current = game.players[game.current]; const me = game.players[0]
  const turnStatus = game.phase === 'draw' ? `${current.id === 'p1' ? '您的' : '对手的'}准备回合` : game.phase === 'discard' ? `${current.id === 'p1' ? '您的' : '对手的'}弃置回合` : game.phase === 'teleport' ? `${current.id === 'p1' ? '您的' : '对手的'}传送选择` : `${current.id === 'p1' ? '您的' : '对手的'}行动回合`
  const seenRoom = (r: Room) => me.seen.includes(key(r))
  const update = (fn: (g: Game) => Game) => setGame((g) => fn(structuredClone(g)))
  const start = (nextMode = mode) => { setMode(nextMode); setGame(newGame(nextMode, selectedRole)); setLobbyStep(1); setShowLobby(false) }
  const log = (g: Game, message: string) => { g.log = [message, ...g.log].slice(0, 5) }
  const revealNearby = (g: Game, player: Player, pos = player.pos) => { (Object.keys(dirs) as Direction[]).forEach((d) => { const r = at(g.rooms, move(pos, d)); if (r && !player.seen.includes(key(r))) player.seen.push(key(r)) }) }
  const damage = (g: Game, player: Player, amount: number, reason: string) => { const blocked = player.shields > 0; if (blocked) player.shields--; else player.hp -= amount; log(g, blocked ? `${player.name} 的护盾抵消了${reason}` : `${player.name} ${reason}，受到 ${amount} 点伤害`); if (player.hp <= 0) g.winner = player.id === 'p1' ? '访客 AI' : '研究员' }
  const checkWin = (g: Game, p: Player) => { if (p.score >= 10) g.winner = p.name }
  const resolveRoom = (g: Game, player: Player, pos: Pos) => {
    const r = at(g.rooms, pos)!; const data = kindData[r.kind]
    if (data.type === 'blank' || (data.type === 'once' && r.depleted)) return
    const notice = (text: string) => { if (player.id === 'p1') g.roomNotice = { title: data.name, text, icon: data.icon } }
    if (r.kind === 'samples') { player.score += 2; log(g, `${player.name} 在样本库取得 +2 积分`); notice('取得样本数据，获得 2 积分。'); r.depleted = true }
    if (r.kind === 'analysis') { player.score++; revealNearby(g, player, pos); log(g, `${player.name} 分析样本：+1 积分，侦察完成`); notice('分析完成：获得 1 积分，并揭示相邻房间。'); r.depleted = true }
    if (r.kind === 'energy') { player.doubleDraw++; log(g, `${player.name} 获得下回合双抽`); notice('能源储备已接入：下回合抽取 2 张行动卡。'); r.depleted = true }
    if (r.kind === 'security') { player.shields++; log(g, `${player.name} 获得一层护盾`); notice('安保协议生效：获得一层护盾。'); r.depleted = true }
    if (r.kind === 'archive') { revealNearby(g, player, pos); log(g, `${player.name} 查阅档案，四邻格已揭示`); notice('档案检索完成：四邻格已揭示。'); r.depleted = true }
    if (r.kind === 'anomaly') { damage(g, player, 2, '接触异常样本'); player.score += 3; log(g, `${player.name} 收容异常，获得 +3 积分`); notice('异常收容完成：受到 2 点伤害，获得 3 积分。'); r.depleted = true }
    if (r.kind === 'medical') { player.hp = Math.min(player.maxHp, player.hp + 3); log(g, `${player.name} 在医疗室回复生命`); notice('医疗处理完成：回复 3 点生命。')}
    if (r.kind === 'meeting') { if ((r.meetingReady || 0) <= player.turns) { player.score++; r.meetingReady = player.turns + 5; log(g, `${player.name} 在会议室取得 +1 积分`); notice('会议结论产出：获得 1 积分。')} else { log(g, '会议室仍在冷却'); notice('会议室仍在冷却，本次未获得积分。') } }
    if (r.kind === 'workshop') { player.hand.push({ id: crypto.randomUUID(), kind: 'breach' }); log(g, `${player.name} 从维修间取得开辟装置`); notice('维修完成：获得一张开辟装置。') }
    if (r.kind === 'teleport') { g.phase = 'teleport'; log(g, `${player.name} 可选择一间已探索房间传送`); notice('传送实验室已启动：请选择一间已探索房间。') }
    checkWin(g, player)
  }
  const resolveAirdrop = (g: Game, player: Player, room: Room) => { if (g.airdropRoomId !== room.id) return false; g.airdropRoomId = undefined; const other = g.players.find((p) => p.id !== player.id); if (other?.seen.includes(key(room))) player.revealedUntil = g.turn + 1; const roll = Math.random(); if (roll < .5) { player.score += 2; if (player.id === 'p1') g.airdropNotice = '获得 2 积分'; log(g, '空投开启：获得 2 积分') } else if (roll < .75) { player.score++; if (player.id === 'p1') g.airdropNotice = '获得 1 积分'; log(g, '空投开启：获得 1 积分') } else { if (player.id === 'p1') { g.phase = 'airdropUpgrade'; g.airdropNotice = '获得一项强化机会'; log(g, '空投开启：请选择一项提升') } else { const boost = player.role === 'scholar' ? 2 : 1; player.attack += boost; log(g, `AI 空投强化：攻击 +${boost}`) } }; checkWin(g, player); return true }
  const enter = (g: Game, player: Player, target: Pos, power = player.attack) => { player.pos = target; if (!player.seen.includes(key(target))) player.seen.push(key(target)); const room = at(g.rooms, target)!; const opponent = g.players.find((p) => p.id !== player.id && eq(p.pos, target)); if (opponent) { damage(g, player, opponent.attack, '遭遇战'); damage(g, opponent, power, '遭遇战') }; if (!g.winner && !resolveAirdrop(g, player, room)) resolveRoom(g, player, target) }
  const canMove = canMoveInState
  const finishAction = (g: Game) => {
    const p = g.players[g.current]; if (g.phase !== 'play' || g.winner) return
    if (p.hand.length > 3) { g.phase = 'discard'; log(g, '行动完成：手牌超限，请弃置至 3 张'); return }
    log(g, '行动完成：可手动结束本回合')
  }
  const endTurn = () => update((g) => {
    if (g.phase === 'teleport' || g.winner || g.phase === 'discard') return g
    const p = g.players[g.current]; if (p.hand.length > 3) { g.phase = 'discard'; log(g, '手牌超限：请弃置至 3 张'); return g }
    p.trackingEnemy = false; p.turns++; g.current = (g.current + 1) % g.players.length; g.acted = false; if (g.current === 0) { g.turn++; if (g.turn >= g.airdropTurn) { const options = g.rooms.filter((room) => !g.players.some((player) => eq(player.pos, room))); const drop = rand(options); g.airdropRoomId = drop.id; g.players.filter((player) => player.role === 'bountyHunter').forEach((hunter) => { if (!hunter.seen.includes(key(drop))) hunter.seen.push(key(drop)) }); g.airdropTurn += 3; log(g, '研究所空投已投放；未领取的旧空投已撤离') } }
    g.phase = 'draw'; log(g, `${g.players[g.current].name} 正在抽取行动卡`); return g
  })
  const useSkill = () => update((g) => { const p = g.players[0]; if (g.current !== 0 || g.phase !== 'play' || p.skillReady > p.turns || p.role === 'scholar') return g; const enemy = g.players[1]; if (p.role === 'athlete') { g.pendingCard = { id: crypto.randomUUID(), kind: 'dash' }; g.pendingSkill = true; p.skillReady = p.turns + 2; log(g, '矫健身姿：请选择相邻合法房间') } else if (enemy) { const frontier: Pos[] = [p.pos]; const seen = new Set([key(p.pos)]); for (let step = 0; step < 2; step++) frontier.splice(0, frontier.length, ...frontier.flatMap((pos) => (Object.keys(dirs) as Direction[]).filter((d) => canMove(g, { ...p, pos }, d)).map((d) => move(pos, d)).filter((pos) => !seen.has(key(pos)) && (seen.add(key(pos)), true)))); p.skillReady = p.turns + 5; if (seen.has(key(enemy.pos))) { enter(g, p, enemy.pos, p.attack * 2); log(g, '战斗本能触发：双倍攻击突进') } else log(g, '战斗本能发动，但敌人不在两步可达范围内') }; return g })
  const choosePrediction = (direction: Direction) => update((g) => { const p = g.players[0]; const enemy = g.players.find((player) => player.id !== p.id); if (g.pendingCard?.kind === 'prediction' && enemy) { enemy.predictedDirection = direction; g.pendingCard = undefined; log(g, `轨迹推演：已预测对手向${dirIcon[direction]}移动`); finishAction(g) }; return g })
  const useCard = (card: Card, asMove = false) => update((g) => {
    const p = g.players[g.current]; if (g.phase !== 'play' || g.winner || g.acted) return g
    if (asMove) { if (!card.direction || !canMove(g, p, card.direction)) return g; if (p.movementLocked > p.turns) { log(g, `${p.name} 的移动被静默干扰器封锁`); return g }; g.acted = true; p.hand = p.hand.filter((x) => x.id !== card.id); if (p.predictedDirection) { if (p.predictedDirection === card.direction) { damage(g, p, 1, '轨迹推演命中'); log(g, `轨迹推演成功：${p.name} 向${dirIcon[card.direction]}移动`) } else log(g, `轨迹推演失败：${p.name} 向${dirIcon[card.direction]}移动`); p.predictedDirection = undefined }; enter(g, p, move(p.pos, card.direction)); log(g, `${p.name} 使用 ${cardData[card.kind].name} 行进 ${dirIcon[card.direction]}`); finishAction(g); return g }
    if (card.kind === 'dash') { g.acted = true; p.hand = p.hand.filter((x) => x.id !== card.id); g.pendingCard = card; log(g, '冲刺协议：请选择一个冲刺方向'); return g }
    if (card.kind === 'breach') { g.acted = true; p.hand = p.hand.filter((x) => x.id !== card.id); g.pendingCard = card; log(g, '选择地图中一面相邻的无门墙进行开辟'); return g }
    g.acted = true
    p.hand = p.hand.filter((x) => x.id !== card.id)
    if (card.kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + 3); log(g, `${p.name} 回复 3 点生命`) }
    if (card.kind === 'scan') { revealNearby(g, p); log(g, `${p.name} 扫描了相邻区域`) }
    if (card.kind === 'locate') { const enemy = g.players.find((x) => x.id !== p.id); if (enemy) { p.seen.push(key(enemy.pos)); p.trackingEnemy = true; log(g, `信标锁定：敌方位于 ${enemy.pos.r + 1}-${enemy.pos.c + 1}`) } }
    if (card.kind === 'prediction') { g.pendingCard = card; log(g, '轨迹推演：请选择预测方向'); return g }
    const boost = p.role === 'scholar' ? 2 : 1
    if (card.kind === 'vitalCore') { p.maxHp += boost; p.hp = Math.min(p.maxHp, p.hp + boost); log(g, `${p.name} 的生命上限 +${boost}`) }
    if (card.kind === 'firstAid') { p.hp = Math.min(p.maxHp, p.hp + boost); log(g, `${p.name} 回复 ${boost} 点生命`) }
    if (card.kind === 'combatSerum') { p.attack += boost; log(g, `${p.name} 的攻击力 +${boost}`) }
    if (card.kind === 'jammer') { const enemy = g.players.find((x) => x.id !== p.id); if (enemy) { enemy.movementLocked = enemy.turns + 1; log(g, '静默干扰器：对手下次移动已封锁') } }
    if (card.kind === 'thorns') { const enemy = g.players.find((x) => x.id !== p.id); if (enemy) damage(g, enemy, Math.ceil(enemy.attack / 2), '反噬荆棘') }
    finishAction(g); return g
  })
  const pickRoom = (target: Room) => update((g) => { const p = g.players[g.current]; if (g.phase === 'teleport' && p.seen.includes(key(target))) { g.phase = 'play'; enter(g, p, { r: target.r, c: target.c }); log(g, `${p.name} 完成传送`); finishAction(g) } else if (g.pendingCard?.kind === 'dash') { const d = (Object.keys(dirs) as Direction[]).find((direction) => eq(move(p.pos, direction), target)); if (d && canMove(g, p, d)) { const skillMove = g.pendingSkill; if (skillMove) enter(g, p, { r: target.r, c: target.c }); else { let next = p.pos; let steps = 0; while (canMove(g, { ...p, pos: next }, d)) { next = move(next, d); if (!p.seen.includes(key(next))) p.seen.push(key(next)); steps++ }; enter(g, p, next); log(g, `${p.name} 冲刺 ${steps} 格`) }; g.pendingCard = undefined; g.pendingSkill = undefined; log(g, `${p.name} 使用${skillMove ? '健身姿' : '冲刺协议'}行进`); if (!skillMove) finishAction(g) } } else if (g.pendingCard?.kind === 'breach') { const nearby = Math.abs(target.r - p.pos.r) + Math.abs(target.c - p.pos.c) === 1; const here = at(g.rooms, p.pos)!; if (nearby && !here.doors.some((d) => eq(move(p.pos, d), target))) { const d = (Object.keys(dirs) as Direction[]).find((x) => eq(move(p.pos, x), target))!; here.doors.push(d); target.doors.push(opposite[d]); g.pendingCard = undefined; log(g, '墙体已开辟：新的门对双方永久开放'); finishAction(g) } }; return g })
  const discard = (id: string) => update((g) => { const p = g.players[g.current]; if (g.phase === 'discard') { p.hand = p.hand.filter((c) => c.id !== id); if (p.hand.length <= 3) { g.phase = 'play'; log(g, '手牌已整理完毕：可结束本回合') } } return g })
  useEffect(() => { if (game.phase !== 'draw' || game.winner) return; const delay = game.current === 0 ? 850 : 1250; const timer = window.setTimeout(() => update((g) => { if (g.phase !== 'draw') return g; const player = g.players[g.current]; if (player.role === 'scholar' && player.id === 'p1') { g.scholarChoices = [randomCard(g.mode, g, player), randomCard(g.mode, g, player), randomCard(g.mode, g, player)]; g.phase = 'scholarPick'; return g }; const draws = player.doubleDraw ? 2 : 1; player.doubleDraw = 0; for (let i = 0; i < draws; i++) player.hand.push(randomCard(g.mode, g, player)); g.phase = 'play'; log(g, `${player.name} 抽取 ${draws} 张行动卡`); return g }), delay); return () => window.clearTimeout(timer) }, [game.phase, game.current, game.winner])
  const chooseScholarCard = (card: Card) => update((g) => { if (g.phase === 'scholarPick') { g.players[0].hand.push(card); g.scholarChoices = undefined; g.phase = 'play'; log(g, '感知万物：已选择行动卡') }; return g })
  const chooseAirdropUpgrade = (choice: 'attack' | 'maxHp' | 'heal') => update((g) => { const p = g.players[0]; if (g.phase !== 'airdropUpgrade') return g; const boost = p.role === 'scholar' ? 2 : 1; if (choice === 'attack') p.attack += boost; if (choice === 'maxHp') { p.maxHp += 2 * boost; p.hp += 2 * boost } if (choice === 'heal') p.hp = Math.min(p.maxHp, p.hp + 2 * boost); g.phase = 'play'; log(g, `空投提升已完成：${choice === 'attack' ? `攻击 +${boost}` : choice === 'maxHp' ? `生命上限 +${2 * boost}` : `回复 ${2 * boost} 生命`}`); return g })
  const chooseDashDirection = (direction: Direction) => update((g) => { const p = g.players[g.current]; if (g.pendingCard?.kind !== 'dash' || !canMove(g, p, direction)) return g; const skillMove = g.pendingSkill; if (skillMove) enter(g, p, move(p.pos, direction)); else { let target = p.pos; let steps = 0; while (canMove(g, { ...p, pos: target }, direction)) { target = move(target, direction); if (!p.seen.includes(key(target))) p.seen.push(key(target)); steps++ } enter(g, p, target); log(g, `${p.name} 冲刺 ${steps} 格`) }; g.pendingCard = undefined; g.pendingSkill = undefined; log(g, `${p.name} 使用${skillMove ? '矫健身姿' : '冲刺协议'}行进`); if (!skillMove) finishAction(g); return g })
  useEffect(() => { if (game.mode !== 'versus' || game.current !== 1 || game.winner || game.phase !== 'play' || game.pendingCard) return; const delay = 3000 + Math.floor(Math.random() * 3001); const timer = window.setTimeout(() => { const ai = game.players[1]; const player = game.players[0]; const adjacent = Math.abs(ai.pos.r - player.pos.r) + Math.abs(ai.pos.c - player.pos.c) === 1; const scoreCard = (card: Card) => card.kind === 'heal' && ai.hp < ai.maxHp * .55 ? 10 : card.kind === 'thorns' && player.hp <= ai.attack ? 9 : card.kind === 'combatSerum' || card.kind === 'vitalCore' ? 7 : card.kind === 'locate' ? 6 : card.kind === 'scan' ? 5 : card.kind === 'dash' && (Object.keys(dirs) as Direction[]).some((d) => canMove(game, ai, d)) ? 5 : card.direction && canMove(game, ai, card.direction) ? (adjacent ? 8 : 4) : 0; const best = [...ai.hand].sort((a,b) => scoreCard(b) - scoreCard(a))[0]; if (best && scoreCard(best) > 0) useCard(best, Boolean(best.direction && scoreCard(best) <= 8)); else { const legalMove = ai.hand.filter((card) => card.direction && canMove(game, ai, card.direction)); const fallback = legalMove.length ? rand(legalMove) : rand(ai.hand); if (fallback) { log(game, 'AI 策略超时，切换为随机决策'); useCard(fallback, Boolean(fallback.direction && canMove(game, ai, fallback.direction))) } else endTurn() } }, delay); return () => window.clearTimeout(timer) }, [game])
  useEffect(() => { if (game.mode !== 'versus' || game.current !== 1 || game.winner || !game.pendingCard) return; const timer = window.setTimeout(() => update((g) => { const ai = g.players[1]; const pending = g.pendingCard; if (!pending) return g; if (pending.kind === 'dash') { const direction = (Object.keys(dirs) as Direction[]).find((d) => canMove(g, ai, d)); if (direction) { let target = ai.pos; while (canMove(g, { ...ai, pos: target }, direction)) { target = move(target, direction); if (!ai.seen.includes(key(target))) ai.seen.push(key(target)) }; enter(g, ai, target); log(g, 'AI 使用冲刺协议冲刺') } else log(g, 'AI 冲刺无可用方向，随机放弃') } else if (pending.kind === 'breach') { const source = at(g.rooms, ai.pos)!; const target = (Object.keys(dirs) as Direction[]).map((d) => ({ d, room: at(g.rooms, move(ai.pos, d)) })).find(({ d, room }) => room && !source.doors.includes(d)); if (target?.room) { source.doors.push(target.d); target.room.doors.push(opposite[target.d]); log(g, 'AI 开辟了一条新通道') } else log(g, 'AI 无可开辟墙体，随机放弃') } else if (pending.kind === 'prediction') { const player = g.players[0]; const legal = (Object.keys(dirs) as Direction[]).filter((d) => canMove(g, player, d)); player.predictedDirection = rand(legal.length ? legal : Object.keys(dirs) as Direction[]); log(g, 'AI 完成轨迹推演') } g.pendingCard = undefined; g.acted = true; finishAction(g); return g }), 950); return () => window.clearTimeout(timer) }, [game])
  useEffect(() => { if (game.mode !== 'versus' || game.current !== 1 || game.winner || game.phase !== 'teleport') return; const timer = window.setTimeout(() => update((g) => { const ai = g.players[1]; const target = rand(g.rooms.filter((room) => ai.seen.includes(key(room)))); if (target) { g.phase = 'play'; enter(g, ai, target); log(g, 'AI 完成传送'); finishAction(g) }; return g }), 950); return () => window.clearTimeout(timer) }, [game])
  useEffect(() => { if (game.mode !== 'versus' || game.current !== 1 || game.winner) return; if (game.phase === 'discard') { const timer = window.setTimeout(() => update((g) => { const ai = g.players[1]; while (ai.hand.length > 3) ai.hand.shift(); g.phase = 'play'; log(g, 'AI 已整理手牌'); return g }), 800); return () => window.clearTimeout(timer) } if (game.phase === 'play' && game.acted && !game.pendingCard) { const timer = window.setTimeout(() => endTurn(), 1100); return () => window.clearTimeout(timer) } }, [game])

  return <main className="app-shell"><div className="rotate-device"><div><i>↻</i><b>请横向旋转设备</b><span>横屏后进入研究所行动界面</span></div></div>
    <section className="game-layout">
      <aside className="player-panel"><div className="status-head"><span className="panel-label">对局状态</span><button onClick={() => { setLobbyStep(1); setShowLobby(true) }}>回到大厅</button></div><div className={`turn-status ${game.phase === 'draw' ? 'drawing' : ''}`}><span>第 {game.turn} 回合</span><b>{turnStatus}</b>{game.phase === 'draw' && <i>抽取中</i>}</div><div className="duel-stats"><PlayerCard player={me} active={game.current === 0} />{mode === 'versus' && <PlayerCard player={game.players[1]} active={game.current === 1} />}</div><div className="objective"><b>胜利条件</b><span>{mode === 'solo' ? '以最少回合取得 10 积分' : '10 积分 / 击败 AI'}</span></div><div className="field-guide"><div className="guide-spine">EXPLORATION GUIDE</div><div className={`guide-page ${guidePage === 'index' ? '' : 'detail-page'}`}>{guidePage === 'index' ? <GuideIndex index={guideIndex} onChange={setGuideIndex} onOpen={setGuidePage} /> : <GuideDetail kind={guidePage} onBack={() => setGuidePage('index')} />}</div></div></aside>
      <div className="board-wrap" data-airdrop={`空投倒计时：${game.airdropRoomId ? '已投放' : Math.max(0, game.airdropTurn - game.turn)} 回合`}>
        <div className="board-caption"><span>{game.winner ? `对局结束 · ${game.winner} 获胜` : `${current.name} 的回合`}</span></div>
        <div className="board">
          {Array.from({ length: 36 }, (_, i) => {
            const pos = { r: Math.floor(i / 6), c: i % 6 }
            const r = at(game.rooms, pos)
            if (!r) return <div key={i} className="void" />
            const visible = seenRoom(r)
            const here = eq(me.pos, pos)
            const enemyHere = game.players.some((p) => p.id === 'ai' && eq(p.pos, pos))
            const canSelect = game.phase === 'teleport' || game.pendingCard?.kind === 'breach' || game.pendingCard?.kind === 'dash'
            const showsPlayer = eq(me.pos, pos)
            const showsEnemy = game.players.some((p) => p.id === 'ai' && eq(p.pos, pos)) && (me.trackingEnemy || me.revealedUntil >= game.turn || Math.abs(me.pos.r - pos.r) + Math.abs(me.pos.c - pos.c) <= 1)
            const hasAirdrop = game.airdropRoomId === r.id && visible
            return <button
              key={r.id}
              data-tooltip={visible ? `${kindData[r.kind].name}：${kindData[r.kind].desc}${r.depleted ? '（已耗尽）' : ''}` : undefined}
              onClick={() => canSelect && pickRoom(r)}
              className={`room ${visible ? 'seen' : 'fog'} ${here ? 'current-room' : ''} ${showsEnemy && !here ? 'enemy-visible' : ''} ${here && enemyHere ? 'contested-room' : ''} ${r.depleted ? 'depleted' : ''}`}
            >
              <span className="doors top">{r.doors.includes('up') && '│'}</span><span className="doors right">{r.doors.includes('right') && '─'}</span><span className="doors bottom">{r.doors.includes('down') && '│'}</span><span className="doors left">{r.doors.includes('left') && '─'}</span>
              {visible ? <><i>{kindData[r.kind].icon}</i><strong>{kindData[r.kind].name}</strong><small>{kindData[r.kind].desc}</small>{hasAirdrop && <span className="airdrop-marker">▰</span>}{r.depleted && <mark>已耗尽</mark>}</> : <><i>?</i><small>未勘测</small></>}
              {showsPlayer && <><span className="sr-only">当前位置</span>{game.pendingCard?.kind === 'dash' && game.current === 0 && (Object.keys(dirs) as Direction[]).filter((direction) => canMove(game, me, direction)).map((direction) => <button key={direction} className={`dash-arrow ${direction}`} onClick={(event) => { event.stopPropagation(); chooseDashDirection(direction) }}>{dirIcon[direction]}</button>)}</>}{showsEnemy && <span className="sr-only">对手位置</span>}
            </button>
          })}
        </div>
      </div>
      <aside className="side-panel" />
    </section>
    <section className="hand-area"><div className="hand-head"><div><h2>{game.winner ? '实验结束' : game.current === 1 ? '对手正在决策' : game.phase === 'discard' ? '选择弃置的行动卡' : '选择一张行动卡'}</h2></div><div className={`turn-actions ${(me.role === 'scholar' || me.role === 'bountyHunter') ? 'passive-role' : ''}`}>{me.role !== 'scholar' && me.role !== 'bountyHunter' && <button className="skill-button" disabled={Boolean(game.winner) || game.current !== 0 || game.phase !== 'play' || me.skillReady > me.turns} onClick={useSkill}>{`${roleData[me.role].skill}${me.skillReady > me.turns ? ` (${me.skillReady - me.turns})` : ''}`}</button>}<button className={`end-turn ${game.current === 0 && game.phase === 'play' && game.acted ? 'ready' : ''}`} disabled={Boolean(game.winner) || game.current !== 0 || game.phase !== 'play'} onClick={endTurn}>跳过 <b>→</b></button></div></div><div className="cards">{me.hand.length === 0 && <div className="empty-hand">准备回合结束后将抽取行动卡</div>}{me.hand.map((card) => <article className={`card ${card.kind} ${game.current === 0 && game.phase === 'discard' ? 'discardable' : ''}`} key={card.id}><div className="card-top"><span>{cardData[card.kind].icon}</span>{card.direction && <b>{dirIcon[card.direction]}</b>}</div><h3>{cardData[card.kind].name}</h3><p>{cardData[card.kind].desc}</p>{game.current === 0 && !game.winner && game.phase === 'play' && !game.pendingCard && <div className="card-actions"><button onClick={() => useCard(card)}>执行功能</button>{card.direction && canMove(game, me, card.direction) && <button onClick={() => useCard(card, true)}>行进 {dirIcon[card.direction]}</button>}</div>}{game.current === 0 && game.phase === 'discard' && <button className="discard" onClick={() => discard(card.id)}>弃置此卡</button>}</article>)}</div></section>
    {game.winner && <div className="victory"><div><p className="eyebrow">PROTOCOL COMPLETE</p><h2>{game.winner} 获胜</h2><p>{mode === 'solo' ? `你用 ${game.turn} 回合完成了研究目标。` : '研究所的控制权已经易主。'}</p><button onClick={() => start(mode)}>开始新实验</button></div></div>}
    {game.phase === 'scholarPick' && <div className="scholar-pick"><div><p className="eyebrow">PERCEPTION OF ALL</p><h2>感知万物</h2><p>从三张行动卡中选择一张。</p><div>{game.scholarChoices?.map((card) => <button key={card.id} onClick={() => chooseScholarCard(card)}><i>{cardData[card.kind].icon}</i><b>{cardData[card.kind].name}</b><span>{cardData[card.kind].desc}</span></button>)}</div></div></div>}
    {game.phase === 'airdropUpgrade' && <div className="scholar-pick"><div><p className="eyebrow">AIRDROP UPGRADE</p><h2>空投强化</h2><p>选择一项提升。</p><div><button onClick={() => chooseAirdropUpgrade('attack')}><i>▲</i><b>攻击强化</b><span>攻击力 +1</span></button><button onClick={() => chooseAirdropUpgrade('maxHp')}><i>♥</i><b>生命扩容</b><span>生命上限 +2</span></button><button onClick={() => chooseAirdropUpgrade('heal')}><i>✚</i><b>紧急修复</b><span>回复 2 生命</span></button></div></div></div>}
    {game.airdropNotice && game.phase !== 'airdropUpgrade' && <div className="airdrop-notice"><div><p className="eyebrow">AIRDROP SECURED</p><i>▰</i><h2>空投已领取</h2><p>{game.airdropNotice}</p><button onClick={() => update((g) => { g.airdropNotice = undefined; return g })}>确认</button></div></div>}
    {game.roomNotice && <div className="room-notice"><div><p className="eyebrow">ROOM EVENT</p><i>{game.roomNotice.icon}</i><h2>{game.roomNotice.title}</h2><p>{game.roomNotice.text}</p><button onClick={() => update((g) => { g.roomNotice = undefined; return g })}>确认</button></div></div>}
    {game.pendingCard?.kind === 'prediction' && <div className="prediction-pick"><div><p className="eyebrow">TRAJECTORY FORECAST</p><h2>轨迹推演</h2><p>猜测对手下一次移动方向。猜中将造成 1 点伤害。</p><div>{(Object.keys(dirs) as Direction[]).map((direction) => <button key={direction} onClick={() => choosePrediction(direction)}>{dirIcon[direction]}</button>)}</div></div></div>}
    {showLobby && <Lobby step={lobbyStep} mode={lobbyMode} role={selectedRole} onLocal={() => setLobbyStep(2)} onMode={(next) => { setLobbyMode(next); setLobbyStep(3) }} onMap={() => setLobbyStep(4)} onRole={setSelectedRole} onBack={() => setLobbyStep((step) => Math.max(1, step - 1) as 1 | 2 | 3 | 4)} onStart={() => start(lobbyMode)} />}
  </main>
}

function PlayerCard({ player, active }: { player: Player; active: boolean }) { return <div className={`stat-card ${active ? 'active' : ''}`}><div className="player-name"><span className={`avatar ${player.id}`}>{player.id === 'p1' ? 'R' : 'A'}</span><div><b>{player.name} - {roleData[player.role].name}</b><small>{active ? '正在行动' : '等待指令'}</small></div></div><div className="meters"><div><span>生命</span><b>{Math.max(0, player.hp)}<em>/{player.maxHp}</em></b><i><u style={{ transform: `scaleX(${Math.max(0, player.hp) / player.maxHp})` }} /></i></div><div><span>积分</span><b>{player.score}<em>/10</em></b><i className="score"><u style={{ width: `${player.score * 10}%` }} /></i></div></div><div className="buffs"><span>攻击 {player.attack}</span>{player.shields > 0 && <span>⬡ 护盾 ×{player.shields}</span>}{player.doubleDraw > 0 && <span>⚡ 下回合双抽</span>}</div></div> }
function Lobby({ step, mode, role, onLocal, onMode, onMap, onRole, onBack, onStart }: { step: 1 | 2 | 3 | 4; mode: Mode; role: Role; onLocal: () => void; onMode: (mode: Mode) => void; onMap: () => void; onRole: (role: Role) => void; onBack: () => void; onStart: () => void }) { const stepTitle = step === 1 ? '选择游玩方式' : step === 2 ? '选择对局模式' : step === 3 ? '选择行动地图' : '选择行动角色'; return <div className="lobby"><div className="lobby-card"><div className="lobby-brand"><span>GV</span><p>GRIDVANE</p><small>卡牌效应</small></div><div className="lobby-progress"><i className={step >= 1 ? 'done' : ''} /><i className={step >= 2 ? 'done' : ''} /><i className={step >= 3 ? 'done' : ''} /><i className={step >= 4 ? 'done' : ''} /></div><p className="eyebrow">LOCAL RESEARCH INITIATIVE</p><h1>GRIDVANE<br /><em>卡牌效应</em></h1><h2>{stepTitle}</h2>{step === 1 && <div className="lobby-options"><button onClick={onLocal}><i>⌂</i><b>本地游玩</b><span>单人挑战与本地 AI 对抗</span></button><button disabled><i>⌁</i><b>联机游玩</b><span>暂未开放 / COMING SOON</span></button></div>}{step === 2 && <div className="lobby-options"><button onClick={() => onMode('solo')}><i>◇</i><b>单人模式</b><span>以最少回合取得 10 积分</span></button><button onClick={() => onMode('versus')}><i>◈</i><b>人机对抗</b><span>对抗 AI，积分或击败取胜</span></button></div>}{step === 3 && <div className="lobby-options"><button onClick={onMap}><i>▦</i><b>科学研究所</b><span>{mode === 'solo' ? '单人勘测任务' : 'AI 对抗任务'} · 实验室、事件与空投</span></button><button disabled><i>⌇</i><b>野外基地</b><span>暂未开放 / COMING SOON</span></button></div>}{step === 4 && <div className="role-picks">{(Object.keys(roleData) as Role[]).map((item) => <button key={item} className={role === item ? 'selected' : ''} onClick={() => onRole(item)}><b>{roleData[item].name}</b><small>生命 {roleData[item].hp} · 攻击 {roleData[item].attack}</small><span>{roleData[item].skill}：{roleData[item].desc}</span></button>)}</div>}<div className="lobby-nav">{step > 1 && <button className="back" onClick={onBack}>← 返回</button>}{step === 4 && <button className="launch" onClick={onStart}>开始行动 →</button>}</div></div></div> }
function GuideIndex({ index, onChange, onOpen }: { index: number; onChange: (index: number) => void; onOpen: (kind: 'rules' | 'airdrop' | RoomKind | CardKind) => void }) { const pages: Array<{ title: string; items: Array<'rules' | 'airdrop' | RoomKind | CardKind> }> = [{ title: '基本规则', items: ['rules', 'airdrop'] }, { title: '功能房间', items: ['samples', 'analysis', 'energy', 'security', 'archive', 'anomaly', 'medical', 'meeting', 'workshop', 'teleport'] }, { title: '行动卡', items: ['heal', 'dash', 'scan', 'locate', 'vitalCore', 'firstAid', 'combatSerum', 'jammer', 'prediction', 'thorns'] }]; const page = pages[index]; const label = (item: 'rules' | 'airdrop' | RoomKind | CardKind) => item === 'rules' ? { icon: '◆', name: '游戏基本规则' } : item === 'airdrop' ? { icon: '▰', name: '空投规则' } : item in kindData ? kindData[item as RoomKind] : cardData[item as CardKind]; return <><p className="guide-kicker">RESEARCH INSTITUTE</p><h2>探索手册</h2><p className="guide-note">记录房间、行动卡与研究所生存规则。</p><div className="guide-section guide-directory"><b>{page.title}</b>{page.items.map((item) => { const data = label(item); return <button key={item} onClick={() => onOpen(item)}><i>{data.icon}</i>{data.name}</button> })}</div><div className="guide-pager"><button disabled={index === 0} onClick={() => onChange(index - 1)}>←</button><span>{index + 1} / {pages.length}</span><button disabled={index === pages.length - 1} onClick={() => onChange(index + 1)}>→</button></div></> }
function GuideDetail({ kind, onBack }: { kind: 'rules' | 'airdrop' | RoomKind | CardKind; onBack: () => void }) { if (kind === 'rules') return <><button className="guide-back" onClick={onBack}>← 返回目录</button><p className="guide-kicker">CORE RULES</p><div className="detail-symbol">◆</div><h2>游戏基本规则</h2><div className="detail-rule"><b>回合与胜利</b><p>每回合抽取 1 张行动卡，可使用 1 张或跳过；行动完成后手动结束回合，手牌超过 3 张必须弃置。单人以最少回合取得 10 积分；人机对抗中先获 10 积分或令对手生命归零即获胜。</p></div><div className="detail-rule"><b>移动与探索</b><p>常规行动卡带随机方向，可沿合法且有门的相邻房间行进。走入房间仅探索本格；侦察效果会揭示周边。冲刺协议选择方向后持续前进至阻断处，并揭示沿途房间。</p></div></>; if (kind === 'airdrop') return <><button className="guide-back" onClick={onBack}>← 返回目录</button><p className="guide-kicker">AIRDROP PROTOCOL</p><div className="detail-symbol">▰</div><h2>空投规则</h2><div className="detail-rule"><b>投放与可见性</b><p>每 3 个全局回合投放一个空投。空投会避开玩家所在房间；只有探索过其所在房间的玩家才能看到补给箱。赏金猎人会自动探索空投落点。</p></div><div className="detail-rule"><b>领取与奖励</b><p>进入空投房时先结算空投，再结算房间。奖励为 50% 获得 2 积分、25% 获得 1 积分、25% 选择攻击强化、生命扩容或紧急修复；学者的属性提升翻倍。</p></div><div className="detail-rule"><b>情报风险</b><p>空投先到先得。若你在对手已探索的空投房领取补给，对手会在下一回合短暂获知你的位置。</p></div></>; const isRoom = kind in kindData; const data = isRoom ? kindData[kind as RoomKind] : cardData[kind as CardKind]; const category = isRoom ? '房间记录' : '行动卡记录'; return <><button className="guide-back" onClick={onBack}>← 返回目录</button><p className="guide-kicker">{category.toUpperCase()}</p><div className="detail-symbol">{data.icon}</div><h2>{data.name}</h2><p className="guide-description">{data.desc}</p><div className="detail-rule"><b>{isRoom ? '触发说明' : '使用说明'}</b><p>{isRoom ? `${(data as typeof kindData[RoomKind]).type === 'once' ? '首次进入时生效，之后保留为空间但不再产出效果。' : (data as typeof kindData[RoomKind]).type === 'repeat' ? '进入此房间时可重复触发对应效果。' : '可安全通过，不会产生任何即时效果。'}` : '使用后消耗该行动卡。除冲刺协议外，行动卡可选择执行功能，或使用其显示方向行进一格。'}</p></div></> }
export default App
