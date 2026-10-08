import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

export class DocumentError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function authorizeCustomer(request: Request, customerId: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new DocumentError(401, 'sign_in');
  const sandbox = { window: {} as { OILREP_CONFIG?: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string } } };
  runInNewContext(await readFile(resolve(process.cwd(), 'config.js'), 'utf8'), sandbox, { timeout: 100 });
  const config = sandbox.window.OILREP_CONFIG;
  if (!config?.SUPABASE_URL || !config.SUPABASE_ANON_KEY) throw new DocumentError(503, 'unavailable');
  const headers = { Authorization: authorization, apikey: config.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const userResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) throw new DocumentError(userResponse.status >= 500 ? 503 : 401, 'sign_in');
  const user = await userResponse.json() as { id: string };
  const snapshotResponse = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/get_snapshot`, {
    method: 'POST', headers, body: '{}',
  });
  if (!snapshotResponse.ok) throw new DocumentError(snapshotResponse.status >= 500 ? 503 : 403, 'not_allowed');
  const snapshot = await snapshotResponse.json() as {
    users: { id: string; active: boolean; role: string }[];
    customers: { id: string | number }[];
  };
  const profile = snapshot.users.find(entry => entry.id === user.id);
  if (!profile?.active || !['admin', 'rep'].includes(profile.role) ||
      !snapshot.customers.some(customer => String(customer.id) === customerId)) {
    throw new DocumentError(403, 'not_allowed');
  }
  return user.id;
}
