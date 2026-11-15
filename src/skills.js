// 직업별 Q / E 스킬: 애니메이션 + 월드 이펙트 + 피해 처리
import * as THREE from 'three';
import { rand, clamp } from './utils.js';

const SKILL_ANIMS = [
  'whirlwind', 'dashstrike', 'multishot', 'barrage', 'ambush', 'flurry',
  'shieldslam', 'fortress', 'explosion', 'nova',
];

function fwd(p) { return p.forward(); }
function flat(v) { return new THREE.Vector3(v.x, 0, v.z); }
function at(p, y) { return new THREE.Vector3(p.position.x, p.position.y + (y || 10), p.position.z); }

export function castSkill(game, key) {
  const p = game.player;
  if (!p || !p.alive) return false;
  const skill = p.cls.skills[key];
  if (!skill) return false;
  if (p.cooldowns[key] > 0) return false;
  if (SKILL_ANIMS.indexOf(p.anim.name) >= 0) return false;
  const impls = IMPLS[p.classId];
  if (!impls || !impls[key]) return false;

  p.cooldowns[key] = skill.cooldown;
  p.attackCooldown = Math.max(p.attackCooldown, 0.15);
  impls[key](game, p);
  game.sfx.skill();
  game.hud.flashSkill(key);
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
