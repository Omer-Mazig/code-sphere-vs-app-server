import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { io, Socket } from 'socket.io-client';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

const PREFIX = api();

describe('Chat HTTP + WebSocket (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestingApp());
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const connectChat = (accessToken: string | null) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`${baseUrl}/chat`, {
        auth: accessToken ? { token: accessToken } : {},
        transports: ['websocket'],
        forceNew: true,
      });
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('socket connect timeout'));
      }, 4000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('connect_error', (error) => {
        clearTimeout(timer);
        socket.close();
        reject(error);
      });
      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          clearTimeout(timer);
          resolve(socket);
        }
      });
    });

  it('creates one 1:1 conversation, persists messages, and hides the thread from a third user', async () => {
    const alice = await registerVerifiedUser(app, 'alice');
    const bob = await registerVerifiedUser(app, 'bob');
    const cara = await registerVerifiedUser(app, 'cara');
    const aliceHeader = bearer(alice.session.accessToken);
    const bobHeader = bearer(bob.session.accessToken);
    const caraHeader = bearer(cara.session.accessToken);

    const created = await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .send({ userId: bob.session.user.id })
      .expect(200);

    expect(created.body.payload.otherUser.id).toBe(bob.session.user.id);
    const conversationId = created.body.payload.id as string;

    const again = await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(bobHeader)
      .send({ userId: alice.session.user.id })
      .expect(200);
    expect(again.body.payload.id).toBe(conversationId);

    await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .send({ userId: alice.session.user.id })
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.CANNOT_MESSAGE_SELF);
      });

    const first = await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(aliceHeader)
      .send({ body: 'hello bob' })
      .expect(201);
    expect(first.body.payload.body).toBe('hello bob');

    await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(aliceHeader)
      .send({ body: '   ' })
      .expect(400);

    const second = await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(bobHeader)
      .send({ body: 'hey alice' })
      .expect(201);

    const messages = await http(app)
      .get(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(aliceHeader)
      .expect(200);
    expect(messages.body.payload.items).toHaveLength(2);
    expect(messages.body.payload.items[0].id).toBe(second.body.payload.id);
    expect(messages.body.payload.items[1].body).toBe('hello bob');

    const inbox = await http(app)
      .get(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .expect(200);
    expect(inbox.body.payload.items).toHaveLength(1);
    expect(inbox.body.payload.items[0].lastMessage.body).toBe('hey alice');

    await http(app)
      .get(`${PREFIX}/chat/conversations/${conversationId}`)
      .set(caraHeader)
      .expect(404)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.CONVERSATION_FORBIDDEN);
      });

    await http(app)
      .get(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(caraHeader)
      .expect(404);
  });

  it('delivers live messages and typing over the websocket', async () => {
    const alice = await registerVerifiedUser(app, 'wsalice');
    const bob = await registerVerifiedUser(app, 'wsbob');
    const aliceHeader = bearer(alice.session.accessToken);

    const created = await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .send({ userId: bob.session.user.id })
      .expect(200);
    const conversationId = created.body.payload.id as string;

    const aliceSocket = await connectChat(alice.session.accessToken);
    const bobSocket = await connectChat(bob.session.accessToken);
    expect(aliceSocket.connected).toBe(true);
    expect(bobSocket.connected).toBe(true);

    await new Promise<void>((resolve, reject) => {
      aliceSocket.emit('join', { conversationId }, (ack: { ok?: boolean }) => {
        if (ack?.ok) {
          resolve();
        } else {
          reject(new Error('alice join failed'));
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      bobSocket.emit('join', { conversationId }, (ack: { ok?: boolean }) => {
        if (ack?.ok) {
          resolve();
        } else {
          reject(new Error('bob join failed'));
        }
      });
    });

    const typing = new Promise<{ conversationId: string; userId: string }>(
      (resolve) => {
        bobSocket.once('typing', (payload) => resolve(payload));
      },
    );
    aliceSocket.emit('typing', { conversationId });
    await expect(typing).resolves.toMatchObject({
      conversationId,
      userId: alice.session.user.id,
    });

    const received = new Promise<{ body: string }>((resolve) => {
      bobSocket.once('message', (payload) => resolve(payload));
    });
    await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(aliceHeader)
      .send({ body: 'live ping' })
      .expect(201);
    await expect(received).resolves.toMatchObject({ body: 'live ping' });

    aliceSocket.close();
    bobSocket.close();
  });

  it('rejects unauthenticated sockets', async () => {
    const socket = await connectChat(null);
    expect(socket.connected).toBe(false);
    socket.close();
  });

  it('tracks unread conversations and marks a thread read', async () => {
    const alice = await registerVerifiedUser(app, 'readalice');
    const bob = await registerVerifiedUser(app, 'readbob');
    const aliceHeader = bearer(alice.session.accessToken);
    const bobHeader = bearer(bob.session.accessToken);

    const created = await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .send({ userId: bob.session.user.id })
      .expect(200);
    const conversationId = created.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(aliceHeader)
      .send({ body: 'unread for bob' })
      .expect(201);

    const unread = await http(app)
      .get(`${PREFIX}/chat/conversations/unread-count`)
      .set(bobHeader)
      .expect(200);
    expect(unread.body.payload.count).toBe(1);

    const thread = await http(app)
      .get(`${PREFIX}/chat/conversations/${conversationId}`)
      .set(bobHeader)
      .expect(200);
    expect(thread.body.payload.unreadCount).toBe(1);

    await http(app)
      .patch(`${PREFIX}/chat/conversations/${conversationId}/read`)
      .set(bobHeader)
      .expect(200);

    const after = await http(app)
      .get(`${PREFIX}/chat/conversations/unread-count`)
      .set(bobHeader)
      .expect(200);
    expect(after.body.payload.count).toBe(0);
  });

  it('blocks the other user from creating or sending', async () => {
    const alice = await registerVerifiedUser(app, 'blkalice');
    const bob = await registerVerifiedUser(app, 'blkbob');
    const aliceHeader = bearer(alice.session.accessToken);
    const bobHeader = bearer(bob.session.accessToken);

    const created = await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(aliceHeader)
      .send({ userId: bob.session.user.id })
      .expect(200);
    const conversationId = created.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/users/${bob.session.user.id}/block`)
      .set(aliceHeader)
      .expect(200);

    const profile = await http(app)
      .get(`${PREFIX}/users/${bob.session.user.id}`)
      .set(aliceHeader)
      .expect(200);
    expect(profile.body.payload.isBlocked).toBe(true);

    await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(bobHeader)
      .send({ body: 'should fail' })
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.CHAT_BLOCKED);
      });

    await http(app)
      .post(`${PREFIX}/chat/conversations`)
      .set(bobHeader)
      .send({ userId: alice.session.user.id })
      .expect(403);

    await http(app)
      .post(`${PREFIX}/users/${bob.session.user.id}/block`)
      .set(aliceHeader)
      .expect(409)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.USER_ALREADY_BLOCKED);
      });

    await http(app)
      .post(`${PREFIX}/users/${alice.session.user.id}/block`)
      .set(aliceHeader)
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.CANNOT_BLOCK_SELF);
      });

    await http(app)
      .delete(`${PREFIX}/users/${bob.session.user.id}/block`)
      .set(aliceHeader)
      .expect(200);

    await http(app)
      .post(`${PREFIX}/chat/conversations/${conversationId}/messages`)
      .set(bobHeader)
      .send({ body: 'back' })
      .expect(201);
  });
});
