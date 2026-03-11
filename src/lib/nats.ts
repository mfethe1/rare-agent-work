import { connect, NatsConnection, StringCodec } from 'nats.ws';

let nc: NatsConnection | null = null;
const sc = StringCodec();

export async function getNatsConnection() {
  if (nc) return nc;

  try {
    const serverURL = process.env.NEXT_PUBLIC_NATS_URL || 'ws://localhost:4222';
    nc = await connect({ servers: serverURL });
    console.log(`Connected to NATS at ${nc.getServer()}`);

    // Optional: connection lifecycle handlers could be added here
    (async () => {
      for await (const s of nc!.status()) {
        console.info(`NATS connection status: ${s.type} - ${s.data}`);
      }
    })();

    return nc;
  } catch (error) {
    console.error('Failed to connect to NATS:', error);
    throw error;
  }
}

export async function publishMessage(subject: string, data: any) {
  const connection = await getNatsConnection();
  connection.publish(subject, sc.encode(JSON.stringify(data)));
}

export async function subscribeToSubject(subject: string, callback: (err: any, msg: any) => void) {
  const connection = await getNatsConnection();
  const sub = connection.subscribe(subject);
  
  (async () => {
    for await (const m of sub) {
      try {
        const decoded = JSON.parse(sc.decode(m.data));
        callback(null, decoded);
      } catch (e) {
        callback(e, null);
      }
    }
  })();
  
  return sub;
}
