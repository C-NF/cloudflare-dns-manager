import { logAudit } from '../../functions/api/_audit.js';
import { createMockKV } from './_helpers.js';

describe('logAudit', () => {
    it('does nothing when kv is null', async () => {
        // Should resolve without throwing
        await expect(logAudit(null, 'alice', 'login', 'ok')).resolves.toBeUndefined();
    });

    it('creates a new log entry on an empty log', async () => {
        const kv = createMockKV();

        await logAudit(kv, 'alice', 'login', 'Logged in from 1.2.3.4');

        expect(kv.get).toHaveBeenCalledWith('AUDIT_LOG');
        expect(kv.put).toHaveBeenCalledTimes(1);

        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);

        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            username: 'alice',
            action: 'login',
            detail: 'Logged in from 1.2.3.4',
        });
        expect(stored[0].timestamp).toBeDefined();
    });

    it('prepends new entries to the beginning of the log', async () => {
        const existingLog = [
            { timestamp: '2025-01-01T00:00:00.000Z', username: 'bob', action: 'logout', detail: '' },
        ];
        const kv = createMockKV({ AUDIT_LOG: JSON.stringify(existingLog) });

        await logAudit(kv, 'alice', 'login', 'new entry');

        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);

        expect(stored).toHaveLength(2);
        expect(stored[0].username).toBe('alice');
        expect(stored[1].username).toBe('bob');
    });

    it('caps the log at 500 entries', async () => {
        const bigLog = Array.from({ length: 500 }, (_, i) => ({
            timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
            username: 'user',
            action: 'action',
            detail: `entry ${i}`,
        }));
        const kv = createMockKV({ AUDIT_LOG: JSON.stringify(bigLog) });

        await logAudit(kv, 'alice', 'login', 'entry that pushes past 500');

        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);

        expect(stored).toHaveLength(500);
        // The newest entry should be first
        expect(stored[0].username).toBe('alice');
        expect(stored[0].detail).toBe('entry that pushes past 500');
    });

    it('entry contains timestamp, username, action, and detail', async () => {
        const kv = createMockKV();

        await logAudit(kv, 'charlie', 'delete_record', 'Deleted A record for example.com');

        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);
        const entry = stored[0];

        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('username', 'charlie');
        expect(entry).toHaveProperty('action', 'delete_record');
        expect(entry).toHaveProperty('detail', 'Deleted A record for example.com');
        // timestamp should be a valid ISO string
        expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    it('silently swallows errors thrown during kv operations', async () => {
        const kv = createMockKV();
        kv.get.mockRejectedValue(new Error('KV unavailable'));

        // Should not throw
        await expect(logAudit(kv, 'alice', 'login', 'ok')).resolves.toBeUndefined();
    });
});
