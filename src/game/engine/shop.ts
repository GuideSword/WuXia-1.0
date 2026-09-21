import type { Content, GameState } from '../model';
import { moveCopy } from './copies';

export function buyItem(state: GameState, npcId: string, itemId: string, content: Content): GameState {
  if (state.phase !== 'town' || state.run) throw new Error('只能在青石镇交易');
  const npc = content.npcs.find((entry) => entry.id === npcId);
  if (!npc || npc.locationId !== state.safeLocationId || !npc.itemsSold?.includes(itemId)) throw new Error('此处不出售该物品');
  if (npcId === 'rescued_prisoner' && (state.permanent.relations.prisoner ?? 0) < 1) throw new Error('尚未救出这位侠士');
  if (npcId === 'tea_visitor' && !state.permanent.heardRumors.includes('taiji_visitor')) throw new Error('尚未探得过客手稿的消息');
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item || item.buyPrice === undefined) throw new Error('该物品不可购买');
  if (state.permanent.coins < item.buyPrice) throw new Error('银两不足');
  const copy = content.copies.find((entry) => entry.itemId === itemId);
  if (copy) {
    if (copy.sourceLocationId !== state.safeLocationId) throw new Error('手抄本不在此处');
    if (state.permanent.copyPositions[copy.id]?.kind !== 'source') throw new Error('这份手抄本已经易主');
    const paid = { ...state, permanent: { ...state.permanent, coins: state.permanent.coins - item.buyPrice } };
    const transferred = moveCopy(paid, copy.id, { kind: 'home' }, { kind: 'source' }, content);
    return { ...transferred, notice: item.buyPrice === 0 ? `从${npc.name}处获赠${item.name}。` : `从${npc.name}处购得${item.name}，花费 ${item.buyPrice} 两。` };
  }
  return {
    ...state,
    permanent: { ...state.permanent, coins: state.permanent.coins - item.buyPrice, stash: { ...state.permanent.stash, [itemId]: (state.permanent.stash[itemId] ?? 0) + 1 } },
    notice: `从${npc.name}处购得${item.name}，花费 ${item.buyPrice} 两。`,
  };
}
