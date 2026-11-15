// 마을 상점(1세계 태초마을 · 2세계 태초마을 대장간): 구매 로직 + 상점 모달 UI
import {
  SHOP, SHOPS, shopById, shopForBiome, shopWeaponsFor, allArmors, allPotions,
} from './config.js';

/* ------------------------------ 구매 로직 ------------------------------ */
// 순수 로직: DOM 없이도 검증 가능 (tests/smoke.mjs)
export function findWeapon(classId, itemId) {
  return shopWeaponsFor(classId, 'shop_w1').concat(shopWeaponsFor(classId, 'shop_w2'))
    .find((w) => w.id === itemId) || null;
}

export function findArmor(itemId) {
  return allArmors().find((a) => a.id === itemId) || null;
}

// 상품이 어느 상점의 것인지 (표시 · 안내용)
export function shopOfItem(itemId) {
  for (const id in SHOPS) {
    const s = SHOPS[id];
    for (const cls in (s.weapons || {})) {
      if (s.weapons[cls].some((w) => w.id === itemId)) return s;
    }
    if ((s.armors || []).some((a) => a.id === itemId)) return s;
    if ((s.potions || []).some((p) => p.id === itemId)) return s;
  }
  return null;
}

export function buyItem(game, itemId) {
  const player = game && game.player;
  if (!player) return { ok: false, msg: '지금은 상점을 이용할 수 없습니다' };
  const gold = Number(game.gold) || 0;

  const weapon = findWeapon(player.classId, itemId);
  if (weapon) {
    // 표시는 Tier 2 ~ 5, 내부 인덱스는 1 ~ 4
    const idx = weapon.tier - 1;
    if (player.weaponTier >= idx) {
      return { ok: false, msg: '이미 보유한 무기입니다' };
    }
    if (gold < weapon.price) {
      return { ok: false, msg: '골드가 ' + (weapon.price - gold) + 'G 부족합니다' };
    }
    game.gold = gold - weapon.price;
    // 무기 보너스는 누적이 아니라 '교체' — 티어에 맞는 보너스로 다시 계산한다
    player.weaponBonus = weapon.damage;
    player.weaponCrit = weapon.crit || 0;
    player.critChance = player.cls.critChance + (weapon.crit || 0);
    player.weaponName = weapon.name;
    player.equipWeaponTier(idx);
    if (typeof game.onWeaponBought === 'function') game.onWeaponBought(weapon);
    return { ok: true, msg: weapon.name + ' 장착 완료! 공격력 +' + weapon.damage, item: weapon };
  }

  // 갑옷: 사면 바로 장착되고 최대 HP · 피해 감소가 붙는다
  const armor = findArmor(itemId);
  if (armor) {
    if (player.armorTier >= armor.tier) {
      return { ok: false, msg: player.armorTier === armor.tier ? '이미 장착한 갑옷입니다' : '더 좋은 갑옷을 입고 있습니다' };
    }
    if (gold < armor.price) {
      return { ok: false, msg: '골드가 ' + (armor.price - gold) + 'G 부족합니다' };
    }
    game.gold = gold - armor.price;
    player.equipArmorTier(armor.tier);
    if (typeof game.onArmorBought === 'function') game.onArmorBought(armor);
    return {
      ok: true,
      msg: armor.name + ' 장착 완료! 최대 HP +' + armor.hp + ' · 받는 피해 ' + Math.round(armor.defense * 100) + '% 감소',
      item: armor,
    };
  }

  const potion = allPotions().find((p) => p.id === itemId);
  if (potion) {
    if (gold < potion.price) {
      return { ok: false, msg: '골드가 ' + (potion.price - gold) + 'G 부족합니다' };
    }
    game.gold = gold - potion.price;
    player.potions[potion.id] = player.potionCount(potion.id) + 1;
    if (typeof game.onPotionBought === 'function') game.onPotionBought(potion);
    return { ok: true, msg: potion.name + ' 1개 구매 (보유 ' + player.potions[potion.id] + '개)', item: potion };
  }

  return { ok: false, msg: '알 수 없는 상품입니다' };
}

/* -------------------------------- 모달 UI -------------------------------- */
const $ = (id) => document.getElementById(id);

const ARMOR_ICONS = { 1: '🦺', 2: '🛡', 3: '👑', 4: '💠', 5: '🔥' };

export class Shop {
  constructor(game) {
    this.game = game;
    this.root = $('shop-overlay');
    this.goldEl = $('shop-gold');
    this.weaponEl = $('shop-weapons');
    this.armorEl = $('shop-armors');
    this.potionEl = $('shop-potions');
    this.toastEl = $('shop-toast');
    this.closeBtn = $('shop-close');
    this.keeperEl = $('shop-keeper');
    this.eyebrowEl = $('shop-eyebrow');
    this.titleEl = $('shop-title');
    this.potionHintEl = $('shop-potion-hint');
    this.isOpen = false;
    this.toastTimer = 0;
    // 지금 열려 있는 상점 (기본: 1세계 태초마을)
    this.shopId = SHOP.id;
    this.applyShop(SHOP.id);

    const buy = (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-buy]') : null;
      if (!btn) return;
      if (e.cancelable) e.preventDefault();
      const id = btn.getAttribute('data-buy');
      if (!id) return;
      // 터치에서 touchstart → click 이 겹쳐 두 번 결제되지 않도록
      const now = Date.now();
      if (this._lastBuy && this._lastBuy.id === id && now - this._lastBuy.t < 400) return;
      this._lastBuy = { id, t: now };
      const res = buyItem(this.game, id);
      this.refresh();
      this.toast(res.msg, res.ok);
      if (res.ok) this.game.sfx.buy(); else this.game.sfx.tone({ freq: 220, to: 150, dur: 0.14, type: 'square', vol: 0.16 });
    };
    for (const el of [this.weaponEl, this.armorEl, this.potionEl]) {
      if (!el) continue;
      el.addEventListener('click', buy);
      el.addEventListener('touchstart', (e) => {
        // iPad: 빠른 탭에서 click이 유실되지 않도록 직접 처리
        const btn = e.target && e.target.closest ? e.target.closest('[data-buy]') : null;
        if (!btn) return;
        buy(e);
      }, { passive: false });
    }
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.game.closeShop());
    if (this.root) {
      this.root.addEventListener('click', (e) => {
        if (e.target === this.root) this.game.closeShop();
      });
    }
  }

  // 어느 마을의 상점인지 (village = 1세계 · village_w2 = 2세계 대장간)
  applyShop(shopId) {
    const shop = shopById(shopId);
    this.shopId = shop.id;
    this.shop = shop;
    if (this.eyebrowEl) this.eyebrowEl.textContent = shop.eyebrow || '태초마을 · 상점';
    if (this.titleEl) this.titleEl.textContent = shop.title || '무기 · 갑옷 · 포션 상점';
    if (this.potionHintEl) {
      this.potionHintEl.textContent = shop.kind === 'world2'
        ? '숫자키 4 · 5 · 6 으로 바로 사용'
        : '숫자키 1 · 2 · 3 으로 바로 사용';
    }
    if (this.keeperEl) {
      this.keeperEl.innerHTML = '<b>' + shop.keeper.name + '</b> · ' + shop.keeper.role
        + ' — "' + shop.keeper.line + '"';
    }
    this._lastBuy = null;
  }

  shopIdForBiome(biomeId) {
    const s = shopForBiome(biomeId);
    return s ? s.id : SHOP.id;
  }

  open(shopId) {
    if (!this.root) return;
    this.applyShop(shopId || this.shopId);
    this.root.classList.remove('hidden');
    this.isOpen = true;
    document.body.classList.add('shop-open');
    this.refresh();
  }

  close() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.isOpen = false;
    document.body.classList.remove('shop-open');
    if (this.toastEl) this.toastEl.classList.remove('on');
  }

  refresh() {
    const game = this.game;
    const p = game.player;
    if (!p || !this.weaponEl) return;
    const shop = this.shop || shopById(this.shopId);
    this._lastBuy = null;
    if (this.goldEl) this.goldEl.textContent = (Number(game.gold) || 0) + ' G';

    const gold = Number(game.gold) || 0;
    const weapons = shopWeaponsFor(p.classId, shop.id);
    this.weaponEl.innerHTML = weapons.map((w) => {
      const idx = w.tier - 1;
      const active = p.weaponTier === idx;
      const owned = p.weaponTier >= idx;
      const poor = !owned && gold < w.price;
      const label = active ? '장착 중' : (owned ? '보유' : w.price + ' G');
      return '<article class="shop-item' + (active ? ' equipped' : '') + '">'
        + '<span class="si-ico">' + (p.cls ? p.cls.glyph : '⚔') + '</span>'
        + '<div class="si-main">'
        + '<div class="si-name">' + w.name + '<span class="si-tier">Tier ' + w.tier + '</span></div>'
        + '<p class="si-desc">' + w.desc + '</p>'
        + '</div>'
        + '<button class="si-buy' + (owned ? ' owned' : '') + (poor ? ' poor' : '') + '" type="button" '
        + 'data-buy="' + w.id + '"' + (owned ? ' disabled' : '') + '>' + label + '</button>'
        + '</article>';
    }).join('');

    if (this.armorEl) {
      const armorNow = p.armorTier || 0;
      this.armorEl.innerHTML = (shop.armors || []).map((a) => {
        const active = armorNow === a.tier;
        const owned = armorNow >= a.tier;
        const poor = !owned && gold < a.price;
        const label = active ? '장착 중' : (owned ? '보유' : a.price + ' G');
        return '<article class="shop-item' + (active ? ' equipped' : '') + '">'
          + '<span class="si-ico">' + (ARMOR_ICONS[a.tier] || '🛡') + '</span>'
          + '<div class="si-main">'
          + '<div class="si-name">' + a.name + '<span class="si-tier">Tier ' + a.tier + '</span></div>'
          + '<p class="si-desc">' + a.desc + '</p>'
          + '</div>'
          + '<button class="si-buy' + (owned ? ' owned' : '') + (poor ? ' poor' : '') + '" type="button" '
          + 'data-buy="' + a.id + '"' + (owned ? ' disabled' : '') + '>' + label + '</button>'
          + '</article>';
      }).join('');
    }

    this.potionEl.innerHTML = (shop.potions || []).map((pt) => {
      const have = p.potionCount(pt.id);
      const poor = gold < pt.price;
      return '<article class="shop-item">'
        + '<span class="si-ico">' + pt.icon + '</span>'
        + '<div class="si-main">'
        + '<div class="si-name">' + pt.name + '<span class="si-tier">[' + pt.key + ']</span></div>'
        + '<p class="si-desc">' + pt.desc + ' <span class="si-have">보유 ' + have + '</span></p>'
        + '</div>'
        + '<button class="si-buy' + (poor ? ' poor' : '') + '" type="button" data-buy="' + pt.id + '">'
        + pt.price + ' G</button>'
        + '</article>';
    }).join('');
  }

  toast(msg, ok) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.toggle('bad', !ok);
    this.toastEl.classList.add('on');
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.toastEl.classList.remove('on'), 2200);
  }
}
