import type { Content, GameState } from '../model';

export function buyItem(state: GameState, npcId: string, itemId: string, content: Content): GameState {
  if (state.phase !== 'town' || state.run) throw new Error('只能在青石镇交易');
  const npc = content.npcs.find((entry) => entry.id === npcId);
  if (!npc || npc.locationId !== state.safeLocationId || !npc.itemsSold?.includes(itemId)) throw new Error('此处不出售该物品');
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item?.buyPrice) throw new Error('该物品不可购买');
  if (state.permanent.coins < item.buyPrice) throw new Error('银两不足');
  return {
    ...state,
    permanent: { ...state.permanent, coins: state.permanent.coins - item.buyPrice, stash: { ...state.permanent.stash, [itemId]: (state.permanent.stash[itemId] ?? 0) + 1 } },
    notice: `从${npc.name}处购得${item.name}，花费 ${item.buyPrice} 两。`,
  };
}
