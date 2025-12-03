export function getPseudoLiveItem(playlist, startEpoch){
  if (!playlist || playlist.length===0) return { item: null, offset: 0 }
  const durations = playlist.map(p=>p.duration||0)
  const total = durations.reduce((a,b)=>a+b,0) || 1
  const start = new Date(startEpoch).getTime()
  const now = Date.now()
  const elapsed = Math.floor(((now - start)/1000) % total)
  let cum = 0
  for (let i=0;i<playlist.length;i++){
    const d = playlist[i].duration || 30
    if (cum + d > elapsed) return { item: playlist[i], offset: elapsed - cum }
    cum += d
  }
  return { item: playlist[0], offset:0 }
}
