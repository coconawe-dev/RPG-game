// 전투 이펙트: 베기 궤적, 충격파 링, 파티클, 오라, 낙하 마력체
import * as THREE from 'three';
import { clamp } from './utils.js';

const FRONT_ARC = (arc) => -Math.PI / 2 - arc / 2;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.lights = [];
  }

  add(item) { this.items.push(item); return item; }

  /* 베기 궤적 (지면과 수평인 부채꼴) */
  slash(pos, yaw, radius, arc, color, opts) {
    const o = opts || {};
    const geo = new THREE.RingGeometry(radius * 0.28, radius, 26, 1, FRONT_ARC(arc), arc);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: o.opacity === undefined ? 0.85 : o.opacity,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + (o.yOffset === undefined ? 6 : o.yOffset), pos.z);
    mesh.rotation.y = yaw;
    if (o.tilt) mesh.rotation.z = o.tilt;
    this.scene.add(mesh);
    const dur = o.duration === undefined ? 0.34 : o.duration;
    const item = {
      t: 0, dur, kind: 'slash',
      update: (dt) => {
        this._tick(item, dt);
        const p = item.t / dur;
        mesh.scale.setScalar(1 + p * (o.grow === undefined ? 0.16 : o.grow));
        mat.opacity = (o.opacity === undefined ? 0.85 : o.opacity) * (1 - p * p);
        mesh.rotation.y = yaw - p * (o.sweep === undefined ? 0 : o.sweep);
      },
      dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); },
    };
    return this.add(item);
  }

  /* 확산하는 충격파 링 */
  ring(pos, color, radius, opts) {
    const o = opts || {};
    const thickness = o.thickness === undefined ? 0.035 : o.thickness;
    const geo = new THREE.TorusGeometry(1, thickness, 6, 56);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + (o.yOffset === undefined ? 2.2 : o.yOffset), pos.z);
    this.scene.add(mesh);
    const dur = o.duration === undefined ? 0.6 : o.duration;
    const item = {
      t: 0, dur, kind: 'ring',
      update: (dt) => {
        this._tick(item, dt);
        const p = clamp(item.t / dur, 0, 1);
        const r = 1 + (radius - 1) * Math.sqrt(p);
        mesh.scale.set(r, 1, r);
        mat.opacity = 0.9 * (1 - p);
      },
      dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); },
    };
    return this.add(item);
  }

  /* 파티클 폭발 */
  burst(pos, color, count, opts) {
    const o = opts || {};
    const n = count || 12;
    const geo = new THREE.SphereGeometry(o.size === undefined ? 0.8 : o.size, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI * 0.5;
      const sp = (o.power === undefined ? 26 : o.power) * (0.45 + Math.random() * 0.8);
      parts.push({
        m,
        v: new THREE.Vector3(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp * 0.9, Math.sin(a) * Math.cos(el) * sp),
      });
      group.add(m);
    }
    this.scene.add(group);
    const dur = o.duration === undefined ? 0.7 : o.duration;
    const grav = o.gravity === undefined ? 34 : o.gravity;
    const item = {
      t: 0, dur, kind: 'burst',
      update: (dt) => {
        this._tick(item, dt);
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          p.v.y -= grav * dt;
          p.m.position.addScaledVector(p.v, dt);
        }
        mat.opacity = 0.95 * (1 - clamp(item.t / dur, 0, 1));
      },
      dispose: () => { this.scene.remove(group); geo.dispose(); mat.dispose(); },
    };
    return this.add(item);
  }

  /* 오브젝트를 따라다니는 오라 (철벽 태세 등) */
  aura(target, color, duration, radius, yOffset) {
    const geo = new THREE.SphereGeometry(radius || 13, 18, 14);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const wireGeo = new THREE.IcosahedronGeometry((radius || 13) * 1.06, 1);
    const wireMat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    this.scene.add(mesh);
    this.scene.add(wire);
    const item = {
      t: 0, dur: duration, kind: 'aura',
      update: (dt) => {
        this._tick(item, dt);
        const p = clamp(item.t / duration, 0, 1);
        mesh.position.copy(target.position);
        mesh.position.y += yOffset === undefined ? 10 : yOffset;
        wire.position.copy(mesh.position);
        mesh.rotation.y += dt * 0.8;
        wire.rotation.y -= dt * 1.1;
        const fade = p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;
        mat.opacity = 0.3 * fade * (0.8 + Math.sin(item.t * 9) * 0.2);
        wireMat.opacity = 0.5 * fade;
        mesh.scale.setScalar(1 + Math.sin(item.t * 5) * 0.03);
      },
      dispose: () => { this.scene.remove(mesh); this.scene.remove(wire); geo.dispose(); mat.dispose(); wireGeo.dispose(); wireMat.dispose(); },
    };
    this.add(item);
    return item;
  }

  /* 잠깐 반짝이는 점광 */
  flash(pos, color, intensity, distance, duration) {
    const light = new THREE.PointLight(color, intensity || 400, distance || 320, 2);
    light.position.set(pos.x, pos.y + 14, pos.z);
    this.scene.add(light);
    const dur = duration || 0.3;
    const item = {
      t: 0, dur, kind: 'flash',
      update: (dt) => {
        this._tick(item, dt);
        light.intensity = (intensity || 400) * (1 - clamp(item.t / dur, 0, 1));
      },
      dispose: () => { this.scene.remove(light); },
    };
    return this.add(item);
  }

  /* 하늘에서 떨어지는 마력체 */
  falling(from, to, duration, color, onHit) {
    const geo = new THREE.SphereGeometry(4.2, 14, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const trailGeo = new THREE.CylinderGeometry(2.6, 4.4, 40, 8, 1, true);
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.y = 20;
    mesh.add(trail);
    const item = {
      t: 0, dur: duration, kind: 'falling', hit: false,
      update: (dt) => {
        this._tick(item, dt);
        const p = clamp(item.t / duration, 0, 1);
        const e = p * p;
        mesh.position.lerpVectors(from, to, e);
        if (p >= 0.999 && !item.hit) { item.hit = true; if (onHit) onHit(); }
        mat.opacity = p > 0.94 ? (1 - p) / 0.06 : 1;
      },
      dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); trailGeo.dispose(); trailMat.dispose(); },
    };
    return this.add(item);
  }

  /* 지면 균열 표시 */
  crack(pos, color, radius, duration) {
    const geo = new THREE.CircleGeometry(radius, 26);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.6, pos.z);
    this.scene.add(mesh);
    const dur = duration || 1.4;
    const item = {
      t: 0, dur, kind: 'crack',
      update: (dt) => {
        this._tick(item, dt);
        const p = clamp(item.t / dur, 0, 1);
        mat.opacity = 0.55 * (1 - p);
      },
      dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); },
    };
    return this.add(item);
  }

  _tick(item, dt) { item.t += dt; }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(dt);
      if (item.t >= item.dur) {
        item.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) item.dispose();
    this.items.length = 0;
  }
}
