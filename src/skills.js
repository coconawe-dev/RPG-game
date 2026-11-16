// 직업별 Q / E 스킬 + 15레벨 필살기(ult) + 20레벨 1차 진화 스킬
// 애니메이션 + 월드 이펙트 + 피해 처리
import * as THREE from 'three';
import { rand, clamp } from './utils.js';

const SKILL_ANIMS = [
  'whirlwind', 'dashstrike', 'multishot', 'barrage', 'ambush', 'flurry',
  'shieldslam', 'fortress', 'explosion', 'nova',
  // 필살기 클립
  'heavenslash', 'meteorrain', 'shadowburst', 'sanctuary', 'arcanemeteor',
];

function fwd(p) { return p.forward(); }
function flat(v) { return new THREE.Vector3(v.x, 0, v.z); }
function at(p, y) { return new THREE.Vector3(p.position.x, p.position.y + (y || 10), p.position.z); }

// 범위 피해 — 거리에 따라 조금씩 약해지고, 밀쳐내는 힘은 직접 준다
function aoe(game, p, center, radius, mult, opts) {
  const o = opts || {};
  const hits = game.mobManager.inRadius(center, radius);
  const critChance = o.critChance === undefined ? p.critChance : o.critChance;
  for (const mob of hits) {
    const dx = mob.position.x - center.x;
    const dz = mob.position.z - center.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    const falloff = clamp(1 - (dist / (radius + 1)) * (o.falloff === undefined ? 0.35 : o.falloff), 0.45, 1);
    game.combat.applyDamage(mob, p.damage * mult * falloff, {
      critChance, critMul: o.critMul, dir: new THREE.Vector3(dx, 0, dz).normalize(),
      knock: o.knock === undefined ? 12 : o.knock,
    });
  }
  return hits.length;
}

// 지금 쓰는 스킬의 실행부 — 진화하면 Q · E 가 강화 스킬로, ult 는 필살기 실행부로
function implFor(p, slot) {
  if (slot === 'ult') return (ULT_IMPLS[p.classId] || {}).ult || null;
  if (p.evolved) {
    const ev = EVOLVED_IMPLS[p.classId];
    if (ev && ev[slot]) return ev[slot];
  }
  return (IMPLS[p.classId] || {})[slot] || null;
}

export function castSkill(game, key) {
  const p = game.player;
  if (!p || !p.alive) return false;
  const slot = (key === 'ult' || key === 'ultimate' || key === 'x') ? 'ult' : key;
  const skill = p.skillFor(slot);
  if (!skill) return false;
  if ((p.cooldowns[slot] || 0) > 0) return false;
  if (SKILL_ANIMS.indexOf(p.anim.name) >= 0) return false;
  const impl = implFor(p, slot);
  if (!impl) return false;

  p.cooldowns[slot] = skill.cooldown;
  p.attackCooldown = Math.max(p.attackCooldown, 0.15);
  impl(game, p);
  if (slot === 'ult') game.sfx.ultCast();
  else game.sfx.skill();
  game.hud.flashSkill(slot);
  return true;
}

const IMPLS = {
  /* ------------------------------ 검사 ------------------------------ */
  warrior: {
    q(game, p) {
      p.playAnim('whirlwind', 0.9);
      p.aimLock = 0.9;
      const ticks = [0.1, 0.32, 0.54, 0.76];
      game.effects.ring(at(p, 2), 0xffd27a, 62, { duration: 0.45 });
      ticks.forEach((t, i) => {
        game.after(t, () => {
          if (!p.alive) return;
          const yaw = p.facing + (i * Math.PI) / 2;
          const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          game.effects.slash(at(p, 9), yaw, 50, Math.PI * 1.0, 0xffe1a3, { duration: 0.26, sweep: 0.9, grow: 0.2, opacity: 0.3 });
          game.combat.melee(p, dir, 56, Math.PI * 2, p.damage * 0.58, { swingFrom: i % 2 === 0, arcVisual: 0.001 });
          game.sfx.swing();
        });
      });
      game.shake(0.3);
      game.hud.banner('회전 베기!', 900);
    },
    e(game, p) {
      p.playAnim('dashstrike', 0.78);
      p.aimLock = 0.8;
      const dir = fwd(p);
      p.dash = { dir: dir.clone(), distance: 120, duration: 0.4, time: 0, progress: 0 };
      game.effects.burst(at(p, 4), 0xffcf8a, 12, { power: 22, size: 0.7, duration: 0.4 });
      game.after(0.4, () => {
        if (!p.alive) return;
        const d = fwd(p);
        const point = new THREE.Vector3(p.position.x + d.x * 34, p.position.y, p.position.z + d.z * 34);
        game.combat.melee(p, d, 64, Math.PI * 1.1, p.damage * 2.0, { arcVisual: Math.PI });
        game.effects.crack(point, 0xffb45c, 56, 1.3);
        game.effects.ring(point, 0xffd27a, 86, { duration: 0.5 });
        game.effects.burst(new THREE.Vector3(point.x, point.y + 4, point.z), 0xffb45c, 20, { power: 34, size: 1.0 });
        game.shake(0.65);
        game.sfx.hit();
      });
      game.hud.banner('돌진 일격!', 900);
    },
  },

  /* ------------------------------ 궁수 ------------------------------ */
  archer: {
    q(game, p) {
      p.playAnim('multishot', 0.7);
      p.aimLock = 0.9;
      game.after(0.38, () => {
        if (!p.alive) return;
        const base = fwd(p);
        for (let i = -2; i <= 2; i++) {
          const a = Math.atan2(base.x, base.z) + i * 0.11;
          const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
          game.combat.fireArrow(p, dir, {
            damage: p.damage * 0.72, speed: 450, range: 330, critChance: p.critChance === undefined ? p.cls.critChance : p.critChance,
          });
        }
        game.effects.burst(at(p, 16), 0xd8ff9a, 8, { power: 14, size: 0.5, duration: 0.4 });
        game.sfx.bow();
      });
      game.hud.banner('멀티샷!', 900);
    },
    e(game, p) {
      p.playAnim('barrage', 1.2);
      p.aimLock = 1.15;
      const back = fwd(p).multiplyScalar(-1);
      p.dash = { dir: back.clone(), distance: 95, duration: 0.42, time: 0, progress: 0 };
      p.vy = 26;
      p.grounded = false;
      for (let i = 0; i < 12; i++) {
        const delay = 0.36 + i * 0.07;
        game.after(delay, () => {
          if (!p.alive) return;
          const base = p.forward();
          const yaw = Math.atan2(base.x, base.z) + rand(-0.5, 0.5);
          const dist = rand(70, 230);
          const tx = p.position.x + Math.sin(yaw) * dist;
          const tz = p.position.z + Math.cos(yaw) * dist;
          const from = new THREE.Vector3(tx, p.position.y + 150, tz);
          game.combat.spawnArrowFrom(from, new THREE.Vector3(0, -1, 0.02), {
            damage: p.damage * 0.55, speed: 320, range: 400, splash: 26, fall: true, vy: -100,
            critChance: p.critChance === undefined ? p.cls.critChance : p.critChance, speedNote: true,
          });
          game.effects.ring(new THREE.Vector3(tx, p.position.y, tz), 0xd8ff9a, 20, { duration: 0.4, yOffset: 0.6 });
        });
      }
      game.shake(0.2);
      game.hud.banner('화살비!', 900);
    },
  },

  /* ------------------------------ 도적 ------------------------------ */
  rogue: {
    q(game, p) {
      p.playAnim('ambush', 0.66);
      p.aimLock = 0.7;
      const dir = fwd(p);
      p.dash = { dir: dir.clone(), distance: 150, duration: 0.26, time: 0, progress: 0 };
      game.effects.burst(at(p, 6), 0x9a7fd0, 14, { power: 20, size: 0.6, duration: 0.4 });
      game.after(0.26, () => {
        if (!p.alive) return;
        const d = fwd(p);
        const target = game.mobManager.nearest(new THREE.Vector3(p.position.x + d.x * 40, p.position.y, p.position.z + d.z * 40), 90);
        if (target) {
          game.combat.applyDamage(target, p.damage * 2.8, {
            critChance: 1, critMul: 2.2,
            dir: new THREE.Vector3(target.position.x - p.position.x, 0, target.position.z - p.position.z).normalize(),
            knock: 14,
          });
          game.effects.burst(new THREE.Vector3(target.position.x, target.position.y + target.height * 0.6, target.position.z), 0xc7a6ff, 16, { power: 26, size: 0.9 });
        }
        game.effects.slash(at(p, 10), Math.atan2(d.x, d.z), 46, 1.1, 0xc7a6ff, { duration: 0.28, sweep: 0.5 });
        game.effects.ring(at(p, 1.5), 0x9a7fd0, 60, { duration: 0.45 });
        game.shake(0.35);
      });
      game.hud.banner('그림자 습격!', 900);
    },
    e(game, p) {
      p.playAnim('flurry', 1.4);
      p.buffs.haste = 4.5;
      game.hud.banner('연격 난무!', 900);
      for (let i = 0; i < 7; i++) {
        game.after(0.16 + i * 0.15, () => {
          if (!p.alive) return;
          const yaw = p.facing + (i % 2 === 0 ? 0.18 : -0.18);
          const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          game.combat.melee(p, dir, 44, Math.PI * 0.9, p.damage * 0.5, { arcVisual: 1.1, swingFrom: i % 2 === 0 });
          game.effects.slash(at(p, 9), yaw, 42, 1.0, 0xc7a6ff, { duration: 0.22, sweep: i % 2 ? 0.5 : -0.5 });
          game.sfx.swing();
        });
      }
    },
  },

  /* ------------------------------ 탱커 ------------------------------ */
  tanker: {
    q(game, p) {
      p.playAnim('shieldslam', 0.82);
      p.aimLock = 0.85;
      game.after(0.36, () => {
        if (!p.alive) return;
        const point = at(p, 2);
        game.combat.explode(point, 120, p.damage * 1.45, {
          color: 0x9fd8ff, knock: 42, particles: 30, shake: 0.7,
        });
        game.effects.crack(point, 0xbfe4ff, 100, 1.6);
        game.hud.banner('방패 강타!', 900);
      });
    },
    e(game, p) {
      p.playAnim('fortress', 1.0);
      p.buffs.fortress = 8;
      p.heal(p.maxHp * 0.12);
      game.effects.aura(p.root, 0xffd98a, 8, 15, 10);
      game.effects.ring(at(p, 1.5), 0xffe1a3, 70, { duration: 0.8 });
      game.hud.banner('철벽 태세!', 1100);
    },
  },

  /* ------------------------------ 마법사 ------------------------------ */
  mage: {
    q(game, p) {
      p.playAnim('explosion', 0.9);
      p.aimLock = 1.0;
      const d = fwd(p);
      const target = new THREE.Vector3(p.position.x + d.x * 150, p.position.y, p.position.z + d.z * 150);
      const from = new THREE.Vector3(target.x, target.y + 220, target.z);
      game.effects.falling(from, target, 0.55, 0xc79bff, () => {
        if (!p.alive) return;
        game.combat.explode(target, 115, p.damage * 2.1, {
          color: 0xc79bff, knock: 24, particles: 34, shake: 0.85,
        });
        game.effects.crack(target, 0x9a5cff, 92, 1.6);
        game.sfx.magic();
      });
      game.effects.slash(at(p, 16), Math.atan2(d.x, d.z), 40, 1.2, 0xc79bff, { duration: 0.4, sweep: 0.4 });
      game.hud.banner('아케인 폭발!', 1000);
    },
    e(game, p) {
      p.playAnim('nova', 0.95);
      p.aimLock = 0.95;
      game.after(0.24, () => {
        if (!p.alive) return;
        const point = at(p, 2);
        game.combat.explode(point, 155, p.damage * 1.05, {
          color: 0x9fd8ff, knock: 36, particles: 30, shake: 0.55, freeze: true,
        });
        game.effects.ring(point, 0xaee8ff, 155, { duration: 0.85, thickness: 0.03 });
        game.effects.ring(point, 0xffffff, 110, { duration: 0.6, thickness: 0.02 });
        game.hud.banner('마력 고리!', 900);
      });
    },
  },
};

/* ==================================================================
   1차 진화(20레벨) — Q · E 가 더 강한 새 스킬로 바뀐다
   ================================================================== */
const EVOLVED_IMPLS = {
  /* 검사: 폭풍 회전난무 · 천둥 돌진참 */
  warrior: {
    q(game, p) {
      p.playAnim('whirlwind', 1.0);
      p.aimLock = 1.0;
      const ticks = [0.08, 0.24, 0.4, 0.56, 0.72, 0.88];
      game.effects.ring(at(p, 2), 0xffe9a0, 84, { duration: 0.55, thickness: 0.05 });
      game.effects.aura(p.root, 0xffd27a, 1.1, 13, 10);
      ticks.forEach((t, i) => {
        game.after(t, () => {
          if (!p.alive) return;
          const yaw = p.facing + (i * Math.PI) / 3;
          const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          game.effects.slash(at(p, 10), yaw, 72, Math.PI * 1.05, i % 2 ? 0xffe9a0 : 0xffb44a, { duration: 0.26, sweep: 1.1, grow: 0.25, opacity: 0.34 });
          game.combat.melee(p, dir, 74, Math.PI * 2, p.damage * 0.62, { swingFrom: i % 2 === 0, arcVisual: 0.001 });
          game.effects.burst(at(p, 8), 0xffd27a, 8, { power: 26, size: 0.6, duration: 0.3 });
          game.sfx.swing();
        });
      });
      // 마지막 한 바퀴 뒤 폭발하는 충격파
      game.after(0.92, () => {
        if (!p.alive) return;
        aoe(game, p, at(p, 2), 96, 0.9, { knock: 34 });
        game.effects.ring(at(p, 2), 0xffffff, 104, { duration: 0.5, thickness: 0.04 });
        game.shake(0.5);
        game.sfx.ultBlast();
      });
      game.shake(0.35);
      game.hud.banner('폭풍 회전난무!', 1000);
    },
    e(game, p) {
      p.playAnim('dashstrike', 0.9);
      p.aimLock = 0.9;
      const dir = fwd(p);
      p.dash = { dir: dir.clone(), distance: 180, duration: 0.42, time: 0, progress: 0 };
      game.effects.burst(at(p, 4), 0xffe9a0, 16, { power: 28, size: 0.9, duration: 0.45 });
      game.after(0.42, () => {
        if (!p.alive) return;
        const d = fwd(p);
        const point = new THREE.Vector3(p.position.x + d.x * 40, p.position.y, p.position.z + d.z * 40);
        game.combat.melee(p, d, 84, Math.PI * 1.3, p.damage * 3.05, { arcVisual: Math.PI * 1.1, color: 0xd8f6ff });
        game.effects.crack(point, 0xbfe4ff, 96, 1.5);
        game.effects.crack(point, 0xffd27a, 66, 1.1);
        game.effects.ring(point, 0xd8f6ff, 118, { duration: 0.55, thickness: 0.05 });
        game.effects.ring(point, 0xffe9a0, 78, { duration: 0.4 });
        game.effects.burst(new THREE.Vector3(point.x, point.y + 4, point.z), 0xd8f6ff, 28, { power: 46, size: 1.2 });
        game.effects.flash(point, 0xd8f6ff, 700, 400, 0.35);
        game.shake(0.85);
        game.sfx.ultBlast();
      });
      game.hud.banner('천둥 돌진참!', 1000);
    },
  },

  /* 궁수: 천풍 연사 · 폭풍우 화살폭격 */
  archer: {
    q(game, p) {
      p.playAnim('multishot', 0.8);
      p.aimLock = 0.95;
      game.after(0.36, () => {
        if (!p.alive) return;
        const base = fwd(p);
        for (let i = -4; i <= 4; i++) {
          const a = Math.atan2(base.x, base.z) + i * 0.075;
          const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
          game.combat.fireArrow(p, dir, {
            damage: p.damage * 0.85, speed: 500, range: 380, critChance: p.critChance,
            pierce: 1,
          });
        }
        game.effects.burst(at(p, 16), 0xd8ff9a, 14, { power: 22, size: 0.7, duration: 0.4 });
        game.effects.ring(at(p, 12), 0xd8ff9a, 46, { duration: 0.4, yOffset: 12 });
        game.sfx.bow();
      });
      game.hud.banner('천풍 연사!', 1000);
    },
    e(game, p) {
      p.playAnim('barrage', 1.5);
      p.aimLock = 1.4;
      const back = fwd(p).multiplyScalar(-1);
      p.dash = { dir: back.clone(), distance: 115, duration: 0.45, time: 0, progress: 0 };
      p.vy = 30;
      p.grounded = false;
      for (let i = 0; i < 20; i++) {
        game.after(0.3 + i * 0.055, () => {
          if (!p.alive) return;
          const base = p.forward();
          const yaw = Math.atan2(base.x, base.z) + rand(-0.45, 0.45);
          const dist = rand(60, 240);
          const tx = p.position.x + Math.sin(yaw) * dist;
          const tz = p.position.z + Math.cos(yaw) * dist;
          const from = new THREE.Vector3(tx, p.position.y + 170, tz);
          game.combat.spawnArrowFrom(from, new THREE.Vector3(0, -1, 0.02), {
            damage: p.damage * 0.68, speed: 340, range: 420, splash: 34, fall: true, vy: -110,
            critChance: p.critChance,
          });
          game.effects.ring(new THREE.Vector3(tx, p.position.y, tz), 0xd8ff9a, 24, { duration: 0.4, yOffset: 0.6 });
        });
      }
      game.shake(0.25);
      game.hud.banner('폭풍우 화살폭격!', 1100);
    },
  },

  /* 도적: 그림자 처형 · 천변 만화 */
  rogue: {
    q(game, p) {
      p.playAnim('ambush', 0.78);
      p.aimLock = 0.8;
      const dir = fwd(p);
      p.dash = { dir: dir.clone(), distance: 195, duration: 0.28, time: 0, progress: 0 };
      game.effects.dashStreak(p.position, p.facing, 0x8a5cff, { count: 4, gap: 15 });
      game.effects.burst(at(p, 6), 0x8a5cff, 18, { power: 24, size: 0.7, duration: 0.4 });
      game.after(0.28, () => {
        if (!p.alive) return;
        const d = fwd(p);
        const target = game.mobManager.nearest(new THREE.Vector3(p.position.x + d.x * 45, p.position.y, p.position.z + d.z * 45), 110);
        if (target) {
          game.combat.applyDamage(target, p.damage * 3.6, {
            critChance: 1, critMul: 2.4,
            dir: new THREE.Vector3(target.position.x - p.position.x, 0, target.position.z - p.position.z).normalize(),
            knock: 20,
          });
          game.effects.burst(new THREE.Vector3(target.position.x, target.position.y + target.height * 0.6, target.position.z), 0xc7a6ff, 24, { power: 32, size: 1.0 });
          game.effects.ring(new THREE.Vector3(target.position.x, target.position.y, target.position.z), 0x8a5cff, 64, { duration: 0.4 });
        }
        // 처형 후 추가 참격 세 번
        for (let i = 0; i < 3; i++) {
          game.after(i * 0.09, () => {
            if (!p.alive) return;
            const yaw = p.facing + (i % 2 === 0 ? 0.35 : -0.35);
            const dd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            game.combat.melee(p, dd, 56, Math.PI * 0.8, p.damage * 0.8, { critChance: 1, arcVisual: 0.9, swingFrom: i % 2 === 0 });
            game.effects.slash(at(p, 9), yaw, 52, 1.0, 0xc7a6ff, { duration: 0.22, sweep: i % 2 ? 0.6 : -0.6 });
          });
        }
        game.effects.ring(at(p, 1.5), 0x8a5cff, 76, { duration: 0.5 });
        game.shake(0.45);
      });
      game.hud.banner('그림자 처형!', 1000);
    },
    e(game, p) {
      p.playAnim('flurry', 1.6);
      p.buffs.haste = 5;
      for (let i = 0; i < 11; i++) {
        game.after(0.12 + i * 0.12, () => {
          if (!p.alive) return;
          const yaw = p.facing + (i % 2 === 0 ? 0.22 : -0.22);
          const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          game.combat.melee(p, dir, 54, Math.PI * 0.95, p.damage * 0.62, { arcVisual: 1.2, swingFrom: i % 2 === 0 });
          game.effects.slash(at(p, 9), yaw, 50, 1.05, i % 3 === 0 ? 0xc7a6ff : 0x8a5cff, { duration: 0.2, sweep: i % 2 ? 0.55 : -0.55 });
          game.sfx.swing();
        });
      }
      game.effects.aura(p.root, 0x9a7fd0, 1.8, 12, 9);
      game.hud.banner('천변 만화!', 1100);
    },
  },

  /* 탱커: 대지 분쇄 · 불굴의 성채 */
  tanker: {
    q(game, p) {
      p.playAnim('shieldslam', 0.95);
      p.aimLock = 0.95;
      game.after(0.4, () => {
        if (!p.alive) return;
        const point = at(p, 2);
        game.combat.explode(point, 170, p.damage * 2.15, {
          color: 0xffd27a, knock: 58, particles: 38, shake: 0.9,
        });
        game.effects.crack(point, 0xbfe4ff, 140, 1.8);
        game.effects.crack(point, 0xffd27a, 104, 1.5);
        game.effects.ring(point, 0xffe9a0, 165, { duration: 0.6, thickness: 0.05 });
        game.effects.burst(new THREE.Vector3(point.x, point.y + 6, point.z), 0xffd27a, 26, { power: 50, size: 1.2 });
        game.hud.banner('대지 분쇄!', 1000);
      });
    },
    e(game, p) {
      p.playAnim('fortress', 1.1);
      // 성채가 솟구치며 주변을 밀쳐내고, 더 오래 · 더 크게 버틴다
      const point = at(p, 2);
      aoe(game, p, point, 140, 1.35, { knock: 46, critChance: 0.15 });
      game.effects.ring(point, 0xffe9a0, 150, { duration: 0.7, thickness: 0.05 });
      game.effects.burst(point, 0xffd27a, 24, { power: 44, size: 1.1 });
      p.buffs.fortress = 12;
      p.heal(p.maxHp * 0.24);
      p.stamina = Math.min(p.maxStamina, p.stamina + 40);
      if (p.staminaExhausted && p.stamina >= p.maxStamina) p.staminaExhausted = false;
      game.effects.aura(p.root, 0xffd98a, 12, 17, 10);
      game.effects.ring(at(p, 1.5), 0xffe9a0, 88, { duration: 0.9, thickness: 0.05 });
      game.effects.ring(at(p, 1.5), 0xffffff, 60, { duration: 0.6 });
      game.effects.pillar(at(p, 0), 0xffd98a, 120, 1.2, 20);
      game.shake(0.4);
      game.hud.banner('불굴의 성채!', 1200);
    },
  },

  /* 마법사: 아케인 심판 · 차원 붕괴 */
  mage: {
    q(game, p) {
      p.playAnim('explosion', 1.05);
      p.aimLock = 1.1;
      const d = fwd(p);
      const target = new THREE.Vector3(p.position.x + d.x * 160, p.position.y, p.position.z + d.z * 160);
      const from = new THREE.Vector3(target.x, target.y + 240, target.z);
      game.effects.ring(target, 0xc79bff, 170, { duration: 0.5, thickness: 0.03 });
      game.effects.falling(from, target, 0.55, 0xc79bff, () => {
        if (!p.alive) return;
        game.combat.explode(target, 165, p.damage * 3.2, {
          color: 0xc79bff, knock: 34, particles: 40, shake: 1.0,
        });
        game.effects.crack(target, 0x9a5cff, 140, 1.8);
        game.effects.ring(target, 0xffffff, 120, { duration: 0.6, thickness: 0.03 });
        game.effects.pillar(target, 0xc79bff, 160, 1.1, 24);
        game.sfx.magic();
        // 두 번째 폭발 — 심판
        game.after(0.42, () => {
          if (!p.alive) return;
          aoe(game, p, target, 140, 1.25, { knock: 26 });
          game.effects.ring(target, 0xffb15c, 150, { duration: 0.7, thickness: 0.05 });
          game.effects.burst(target, 0xffb15c, 30, { power: 54, size: 1.4 });
          game.effects.flash(target, 0xc79bff, 900, 520, 0.4);
          game.shake(0.7);
          game.sfx.ultBlast();
        });
      });
      game.effects.slash(at(p, 16), Math.atan2(d.x, d.z), 48, 1.3, 0xc79bff, { duration: 0.45, sweep: 0.4 });
      game.hud.banner('아케인 심판!', 1100);
    },
    e(game, p) {
      p.playAnim('nova', 1.05);
      p.aimLock = 1.05;
      game.after(0.22, () => {
        if (!p.alive) return;
        const point = at(p, 2);
        game.combat.explode(point, 215, p.damage * 1.7, {
          color: 0x9fd8ff, knock: 44, particles: 36, shake: 0.7, freeze: true,
        });
        game.effects.ring(point, 0xaee8ff, 215, { duration: 0.95, thickness: 0.03 });
        game.effects.ring(point, 0xffffff, 160, { duration: 0.7, thickness: 0.02 });
        game.effects.pillar(point, 0xaee8ff, 150, 1.0, 26);
        game.after(0.34, () => {
          if (!p.alive) return;
          aoe(game, p, point, 195, 0.55, { knock: 18 });
          game.effects.ring(point, 0x9a5cff, 185, { duration: 0.7, thickness: 0.04 });
          game.effects.burst(point, 0xaee8ff, 26, { power: 50, size: 1.2 });
          game.shake(0.45);
        });
        game.hud.banner('차원 붕괴!', 1100);
      });
    },
  },
};

/* ==================================================================
   15레벨 필살기 (쿨타임 75초 · X 키)
   ================================================================== */
const ULT_IMPLS = {
  /* 검사 — 천공의 일섬: 세 번의 거대한 황금 참격 + 충격파 */
  warrior: {
    ult(game, p) {
      p.playAnim('heavenslash', 1.75);
      p.aimLock = 1.7;
      game.hud.banner('천공의 일섬!', 1700);
      game.effects.pillar(at(p, 0), 0xffd24a, 170, 1.5, 26);
      game.effects.ring(at(p, 2), 0xffe9a0, 100, { duration: 0.55, thickness: 0.05 });
      const dir = fwd(p);
      p.dash = { dir: dir.clone(), distance: 80, duration: 0.32, time: 0, progress: 0 };
      const waves = [
        { t: 0.34, mult: 2.2, radius: 130, color: 0xffe9a0, shake: 0.7 },
        { t: 0.74, mult: 2.0, radius: 150, color: 0xffb44a, shake: 0.8 },
        { t: 1.16, mult: 3.2, radius: 180, color: 0xff6a3c, shake: 1.1 },
      ];
      for (const w of waves) {
        game.after(w.t, () => {
          if (!p.alive) return;
          const d = fwd(p);
          const yaw = Math.atan2(d.x, d.z);
          const point = new THREE.Vector3(p.position.x + d.x * 30, p.position.y, p.position.z + d.z * 30);
          aoe(game, p, at(p, 2), w.radius, w.mult, { knock: 46 });
          // 앞쪽에는 한 번 더 강하게 (참격이 지나간 자리)
          aoe(game, p, point, w.radius * 0.62, w.mult * 0.45, { knock: 60 });
          game.effects.slash(at(p, 12), yaw, w.radius, Math.PI * 1.6, w.color, { duration: 0.36, sweep: 1.2, grow: 0.3, opacity: 0.62 });
          game.effects.ring(point, w.color, w.radius * 1.05, { duration: 0.55, thickness: 0.06 });
          game.effects.crack(point, w.color, w.radius * 0.65, 1.2);
          game.effects.burst(at(p, 10), w.color, 30, { power: 52, size: 1.3 });
          game.effects.flash(at(p, 10), w.color, 900, 520, 0.4);
          game.shake(w.shake);
          game.sfx.ultBlast();
        });
      }
    },
  },

  /* 궁수 — 유성 화살비: 하늘에서 유성 화살이 쏟아진다 */
  archer: {
    ult(game, p) {
      p.playAnim('meteorrain', 1.95);
      p.aimLock = 1.9;
      game.hud.banner('유성 화살비!', 1700);
      const base = fwd(p);
      const yaw0 = Math.atan2(base.x, base.z);
      const center = new THREE.Vector3(p.position.x + base.x * 130, p.position.y, p.position.z + base.z * 130);
      game.effects.ring(center, 0xffd27a, 200, { duration: 1.1, thickness: 0.04 });
      game.effects.ring(center, 0xff8a3c, 120, { duration: 0.95, thickness: 0.03 });
      game.effects.flash(at(p, 18), 0xffd27a, 800, 460, 0.5);
      // 첫 폭격 — 화살 폭풍이 한 번에 휩쓸고 지나간다
      game.after(0.5, () => {
        if (!p.alive) return;
        aoe(game, p, center, 200, 2.6, { knock: 30 });
        game.shake(0.6);
        game.sfx.ultBlast();
      });
      // 이후 24발의 유성 화살이 계속 떨어진다
      for (let i = 0; i < 24; i++) {
        game.after(0.45 + i * 0.055, () => {
          if (!p.alive) return;
          const a = yaw0 + rand(-1.0, 1.0);
          const dist = rand(10, 140);
          const tx = center.x + Math.sin(a) * dist;
          const tz = center.z + Math.cos(a) * dist;
          const from = new THREE.Vector3(tx, p.position.y + 250, tz);
          game.combat.spawnArrowFrom(from, new THREE.Vector3(0, -1, 0.02), {
            damage: p.damage * 1.3, speed: 400, range: 540, splash: 52, fall: true, vy: -130,
            critChance: p.critChance,
          });
          game.effects.ring(new THREE.Vector3(tx, p.position.y, tz), 0xffd27a, 30, { duration: 0.45, yOffset: 0.8 });
        });
      }
      game.shake(0.3);
    },
  },

  /* 도적 — 그림자 절멸: 그림자 분신이 다섯 번 폭발 (확정 치명타) */
  rogue: {
    ult(game, p) {
      p.playAnim('shadowburst', 1.6);
      p.aimLock = 1.5;
      game.hud.banner('그림자 절멸!', 1700);
      game.effects.aura(p.root, 0x8a5cff, 1.8, 18, 10);
      game.effects.pillar(at(p, 0), 0x8a5cff, 150, 1.4, 24);
      p.buffs.haste = 6;
      for (let i = 0; i < 5; i++) {
        game.after(0.2 + i * 0.17, () => {
          if (!p.alive) return;
          const point = at(p, 2);
          const yaw = p.facing + (i % 2 ? 0.6 : -0.6);
          aoe(game, p, point, 145, 1.15, { critChance: 1, critMul: 2.0, knock: 18 });
          game.effects.slash(at(p, 11), yaw, 145, Math.PI * 1.35, i % 2 ? 0xc7a6ff : 0x8a5cff,
            { duration: 0.3, sweep: i % 2 ? 0.95 : -0.95, grow: 0.4, opacity: 0.55 });
          game.effects.ring(point, 0x9a7fd0, 130, { duration: 0.45, thickness: 0.05 });
          game.effects.burst(at(p, 8), 0xc7a6ff, 28, { power: 46, size: 1.1 });
          game.effects.flash(at(p, 8), 0x8a5cff, 600, 400, 0.3);
          game.shake(0.45);
          game.sfx.ultBlast();
        });
      }
      game.shake(0.3);
    },
  },

  /* 탱커 — 불멸의 성역: 황금 성역 강타 + 대회복 + 8초 수호 */
  tanker: {
    ult(game, p) {
      p.playAnim('sanctuary', 1.85);
      p.aimLock = 1.7;
      game.hud.banner('불멸의 성역!', 1800);
      game.effects.pillar(at(p, 0), 0xffe9a0, 230, 1.9, 34);
      game.effects.ring(at(p, 1.5), 0xffd24a, 140, { duration: 1.0, thickness: 0.04 });
      game.effects.aura(p.root, 0xffd98a, 1.9, 22, 12);
      game.after(0.5, () => {
        if (!p.alive) return;
        const point = at(p, 2);
        aoe(game, p, point, 225, 3.2, { knock: 74, critChance: 0.25 });
        game.effects.ring(point, 0xffd24a, 245, { duration: 0.9, thickness: 0.08 });
        game.effects.ring(point, 0xffffff, 165, { duration: 0.65, thickness: 0.04 });
        game.effects.crack(point, 0xffd24a, 205, 1.7);
        game.effects.burst(point, 0xffe9a0, 42, { power: 72, size: 1.7 });
        game.effects.flash(point, 0xffe9a0, 1100, 620, 0.5);
        game.shake(1.1);
        game.sfx.ultBlast();
        // 성역의 축복 — 큰 회복 · 스태미나 회복 · 8초 수호
        p.heal(p.maxHp * 0.6);
        p.stamina = p.maxStamina;
        p.staminaExhausted = false;
        p.buffs.fortress = Math.max(p.buffs.fortress, 8);
        game.effects.aura(p.root, 0xffd98a, 8, 17, 10);
      });
    },
  },

  /* 마법사 — 아케인 메테오: 거대 유성 + 잔불 */
  mage: {
    ult(game, p) {
      p.playAnim('arcanemeteor', 1.95);
      p.aimLock = 1.9;
      game.hud.banner('아케인 메테오!', 1800);
      const d = fwd(p);
      const target = new THREE.Vector3(p.position.x + d.x * 170, p.position.y, p.position.z + d.z * 170);
      game.effects.ring(target, 0xc79bff, 245, { duration: 0.95, thickness: 0.04 });
      game.effects.ring(target, 0xffffff, 160, { duration: 0.8, thickness: 0.02 });
      game.effects.falling(new THREE.Vector3(target.x, target.y + 330, target.z), target, 0.85, 0xc79bff, () => {
        if (!p.alive) return;
        aoe(game, p, target, 245, 4.6, { critChance: 0.3, knock: 54 });
        game.effects.ring(target, 0xc79bff, 265, { duration: 1.0, thickness: 0.08 });
        game.effects.ring(target, 0xffffff, 185, { duration: 0.7, thickness: 0.04 });
        game.effects.crack(target, 0x9a5cff, 235, 1.9);
        game.effects.pillar(target, 0xc79bff, 240, 1.5, 32);
        game.effects.burst(target, 0xc79bff, 42, { power: 84, size: 1.8 });
        game.effects.flash(target, 0xc79bff, 1200, 720, 0.6);
        game.shake(1.15);
        game.sfx.ultBlast();
        // 잔불 — 0.55초 뒤 한 번 더 터진다
        game.after(0.55, () => {
          if (!p.alive) return;
          aoe(game, p, target, 195, 1.45, { critChance: 0.2, knock: 22 });
          game.effects.ring(target, 0xff9a3c, 205, { duration: 0.75, thickness: 0.05 });
          game.effects.burst(target, 0xff9a3c, 30, { power: 58, size: 1.4 });
          game.shake(0.5);
        });
      });
    },
  },
};
