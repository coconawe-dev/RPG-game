// 수동 점검: 공개 WSS 중계 서버에서 서로 다른 두 클라이언트가 메시지를 주고받는지 확인
// 실행: node --experimental-websocket tests/relay-live.mjs
import { RelayClient, BROKERS } from '../src/net.js';

const topic = 'rpgmp/1/LIVE' + Math.floor(Math.random() * 9000 + 1000) + '/h';

async function run(broker) {
  const a = new RelayClient(broker.url);
  const b = new RelayClient(broker.url);
  const got = [];
  try {
    await a.connect('liveA' + Math.random().toString(36).slice(2, 8), 9000);
    await b.connect('liveB' + Math.random().toString(36).slice(2, 8), 9000);
    a.onPublish = (t, body) => { if (t === topic) got.push(body); };
    a.subscribe(topic);
    await new Promise((r) => setTimeout(r, 700));
    b.publish(topic, 'ping-1');
    await new Promise((r) => setTimeout(r, 1200));
    b.publish(topic, 'ping-2');
    await new Promise((r) => setTimeout(r, 1500));
    console.log(broker.name, '→ 받은 메시지:', JSON.stringify(got));
    return got.length === 2;
  } catch (e) {
    console.log(broker.name, '실패:', e.message);
    return false;
  } finally {
    a.close();
    b.close();
  }
}

let ok = 0;
for (const b of BROKERS) {
  if (await run(b)) ok++;
}
console.log(ok === BROKERS.length ? 'RELAY OK' : 'RELAY INCOMPLETE ' + ok + '/' + BROKERS.length);
process.exit(ok === BROKERS.length ? 0 : 1);
